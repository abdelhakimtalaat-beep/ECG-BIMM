'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '@/components/store';
import { FilterBar } from '@/components/FilterBar';
import { ModelButton } from '@/components/ModelButton';
import { Empty, PageHeader, Spinner, StatusBadge, useToast } from '@/components/ui';
import { api, fmtDateTime } from '@/lib/client';
import { STATUS_COLORS, STATUSES, type Project } from '@/lib/types';

declare global { interface Window { L?: any } }
interface Geo { id: string; lat: number | null; lng: number | null; precision: string | null; address: string | null; note: string | null; updated: string | null }
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
const PRECISION: Record<string, string> = { acc: 'Exact (coordinates in ACC)', pluscode: 'Exact (Plus Code in the ACC address)', address: 'Street address in ACC', city: 'City only (the ACC address is general)' };

/** Loads the Leaflet map library once (script + style) and gives it back. */
let load: Promise<any> | null = null;
const loadLeaflet = () => (load ??= new Promise<any>((res, rej) => {
  if (window.L) return res(window.L);
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${LEAFLET}/leaflet.css`; css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = ''; document.head.appendChild(css);
  const s = document.createElement('script'); s.src = `${LEAFLET}/leaflet.js`; s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; s.crossOrigin = '';
  s.onload = () => res(window.L); s.onerror = () => { load = null; rej(new Error('The map could not be loaded (check the internet connection)')); }; document.head.appendChild(s);
}));
const pinSvg = (c: string, on: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" width="${on ? 38 : 30}" height="${on ? 50 : 40}" viewBox="0 0 30 40"><path d="M15 39C15 39 2 24.5 2 14.5a13 13 0 0 1 26 0C28 24.5 15 39 15 39z" fill="${c}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>`;
/** Projects that share (almost) the same spot are spread on a small ring so every pin can be clicked. */
function spread(items: { id: string; lat: number; lng: number }[]) {
  const groups = new Map<string, typeof items>(); for (const i of items) { const k = `${i.lat.toFixed(4)},${i.lng.toFixed(4)}`; groups.set(k, [...(groups.get(k) ?? []), i]); }
  const out = new Map<string, [number, number]>();
  for (const g of groups.values()) g.forEach((i, n) => { if (g.length === 1) return out.set(i.id, [i.lat, i.lng]); const a = (2 * Math.PI * n) / g.length, r = 0.0006 + g.length * 0.00008; out.set(i.id, [i.lat + r * Math.sin(a), i.lng + (r * Math.cos(a)) / Math.max(0.3, Math.cos((i.lat * Math.PI) / 180))]); });
  return out;
}

export default function MapPage() {
  const { me, data, projects } = useApp(); const toast = useToast();
  const [geo, setGeo] = useState<Geo[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [sel, setSel] = useState<string | null>(null); const [showMissing, setShowMissing] = useState(false);
  const el = useRef<HTMLDivElement>(null); const map = useRef<any>(null); const layer = useRef<any>(null); const markers = useRef(new Map<string, any>()); const fitted = useRef(false);
  const canRefresh = me.role === 'admin' || me.role === 'bim_manager';
  const reload = useCallback(() => api<{ rows: Geo[] }>('/api/acc/locations').then((r) => setGeo(r.rows)).catch((e) => { setErr(e.message); setGeo([]); }), []);
  useEffect(() => { reload(); }, [reload]);

  const mgr = useMemo(() => { const e = new Map<string, string>(data.employees.map((x) => [x.id, x.name] as [string, string])); const m = new Map<string, string[]>(); for (const a of data.assignments) if (a.role === 'manager') m.set(a.project_id, [...(m.get(a.project_id) ?? []), e.get(a.employee_id) ?? '']); return m; }, [data]);
  const gm = useMemo(() => new Map((geo ?? []).map((g) => [g.id, g])), [geo]);
  const located = useMemo(() => projects.filter((p) => gm.get(p.id)?.lat != null), [projects, gm]); const missing = useMemo(() => projects.filter((p) => gm.get(p.id)?.lat == null), [projects, gm]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]); const cur = sel ? byId.get(sel) ?? null : null;

  /* the map itself (created once) */
  useEffect(() => { let dead = false; loadLeaflet().then((L) => {
    if (dead || !el.current || map.current) return;
    const m = L.map(el.current, { center: [27, 30], zoom: 5, worldCopyJump: true }); map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m); setReady(true);
  }).catch((e) => setErr(e.message)); return () => { dead = true; }; }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => () => { try { map.current?.remove(); } catch {} map.current = null; }, []);

  /* the pins (redrawn when the filters change) */
  useEffect(() => {
    const L = window.L, m = map.current; if (!ready || !L || !m || !layer.current) return;
    layer.current.clearLayers(); markers.current.clear();
    const pts = located.map((p) => ({ id: p.id, lat: gm.get(p.id)!.lat as number, lng: gm.get(p.id)!.lng as number })); const at = spread(pts);
    for (const p of located) {
      const pos = at.get(p.id)!; const c = STATUS_COLORS[p.status] ?? '#1F6FC9';
      const mk = L.marker(pos, { icon: L.divIcon({ className: '', html: pinSvg(c, false), iconSize: [30, 40], iconAnchor: [15, 39] }), title: `${p.project_no ? p.project_no + ' · ' : ''}${p.name}`, keyboard: true });
      mk.on('click', () => setSel(p.id)); mk.addTo(layer.current); markers.current.set(p.id, mk);
    }
    if (!fitted.current && pts.length) { fitted.current = true; const b = L.latLngBounds(pts.map((x) => [x.lat, x.lng])); m.fitBounds(b, { padding: [50, 50], maxZoom: 12 }); }
  }, [ready, located, gm]);
  /* highlight + centre the chosen project */
  useEffect(() => {
    const L = window.L, m = map.current; if (!ready || !L || !m) return;
    for (const [id, mk] of markers.current) { const p = byId.get(id); const c = p ? STATUS_COLORS[p.status] ?? '#1F6FC9' : '#1F6FC9'; const on = id === sel; mk.setIcon(L.divIcon({ className: '', html: pinSvg(c, on), iconSize: on ? [38, 50] : [30, 40], iconAnchor: on ? [19, 49] : [15, 39] })); mk.setZIndexOffset(on ? 1000 : 0); }
    const mk = sel ? markers.current.get(sel) : null; if (mk) m.flyTo(mk.getLatLng(), Math.max(m.getZoom(), 12), { duration: 0.6 });
  }, [sel, ready, byId, located]);

  const refresh = async (force: boolean) => {
    setBusy(true); try {
      for (let i = 0; i < 8; i++) { const r = await api<{ message: string; more: boolean; unlocated: number }>(`/api/acc/locations${force && i === 0 ? '?force=1' : ''}`, { method: 'POST' }); await reload(); if (!r.more) { toast(r.message + (r.unlocated ? `; ${r.unlocated} still without a location` : '')); break; } }
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const lastUpdate = useMemo(() => (geo ?? []).map((g) => g.updated).filter(Boolean).sort().pop() ?? null, [geo]);

  return (<>
    <PageHeader title="Projects Map" subtitle={geo ? `${located.length} of ${projects.length} projects on the map · locations come from the project address in ACC${lastUpdate ? ` · read ${fmtDateTime(lastUpdate)}` : ''}` : 'Loading…'}
      actions={canRefresh ? <button className="btn-secondary" disabled={busy} onClick={() => refresh(false)} title="Read the project addresses from ACC again"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />{busy ? 'Reading ACC…' : 'Update from ACC'}</button> : undefined} />
    <FilterBar show={['q', 'manager', 'coordinator', 'status', 'client', 'type']} />
    {err && <div className="card mb-3 border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</div>}
    {!geo ? <Spinner label="Loading the map" /> : <>
      {!located.length && !busy && <div className="card mb-3 p-4 text-sm text-slate-700"><b>No project has a location yet.</b> {canRefresh ? <>Press <b>Update from ACC</b>: the portal reads each project's address from ACC and places the pin. To change a pin, edit the address in ACC (Project Admin &gt; Settings &gt; Address) and update again.</> : 'An administrator has to read the project addresses from ACC first.'}</div>}
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="card relative overflow-hidden p-0"><div ref={el} className="h-[560px] w-full bg-slate-100" role="application" aria-label="Map of the projects" />
          <div className="pointer-events-none absolute bottom-6 left-3 z-[500] flex flex-wrap gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs shadow">{STATUSES.map((s) => <span key={s} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />{s}</span>)}</div></div>
        <div className="card flex max-h-[560px] flex-col overflow-hidden p-0">
          {cur ? <ProjectCard p={cur} geo={gm.get(cur.id)} managers={mgr.get(cur.id) ?? []} onClose={() => setSel(null)} />
            : <><div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-brand-900">Projects on the map ({located.length})</div>
              <ul className="flex-1 overflow-y-auto">{located.map((p) => <li key={p.id}><button className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => setSel(p.id)}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS[p.status] }} /><span className="min-w-0 flex-1 truncate">{p.project_no ? <b>{p.project_no}</b> : null}{p.project_no ? ' · ' : ''}{p.name}</span></button></li>)}
                {!located.length && <li className="p-3 text-sm text-slate-500">Nothing to show yet.</li>}</ul></>}
        </div>
      </div>
      {!!missing.length && <div className="card mt-3 p-3"><button className="flex w-full items-center justify-between text-left text-sm font-semibold text-amber-800" onClick={() => setShowMissing((v) => !v)} aria-expanded={showMissing}><span className="flex items-center gap-2"><MapPin size={16} />Not located yet ({missing.length})</span><span className="text-xs font-normal text-slate-500">{showMissing ? 'Hide' : 'Show'}</span></button>
        {showMissing && <><p className="mt-2 text-xs text-slate-600">Fix these in ACC (Project Admin &gt; Settings &gt; Address), then press Update from ACC.</p>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">{missing.map((p) => <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5"><span>{p.project_no ? <b>{p.project_no}</b> : null}{p.project_no ? ' · ' : ''}{p.name}</span><span className="text-xs text-slate-500">{gm.get(p.id)?.note ?? 'Not read from ACC yet'}</span></li>)}</ul></>}</div>}
    </>}
  </>);
}

function ProjectCard({ p, geo, managers, onClose }: { p: Project; geo?: Geo; managers: string[]; onClose: () => void }) {
  const forma = p.forma_url && /^https?:\/\/\S+$/i.test(p.forma_url) ? p.forma_url : null;
  const row = (k: string, v?: string | null) => v ? <div className="flex gap-2 py-0.5 text-sm"><dt className="w-24 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 flex-1 break-words">{v}</dd></div> : null;
  return (<div className="flex-1 overflow-y-auto p-3">
    <button className="mb-2 text-xs text-brand-700 hover:underline" onClick={onClose}>← All projects</button>
    <h3 className="font-semibold leading-snug text-brand-900">{p.name}</h3>
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusBadge status={p.status} />{forma && <a href={forma} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-brand-600 bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-brand-700"><ExternalLink size={12} />Forma</a>}<ModelButton id={p.id} name={p.name} /></div>
    <dl className="mt-2">{row('Number', p.project_no)}{row('Client', p.client)}{row('Type', p.type)}{row('BIM Manager', managers.filter(Boolean).join(', '))}{row('City', [p.city, p.country].filter(Boolean).join(', '))}{row('ACC address', geo?.address)}{row('Pin from', geo?.precision ? PRECISION[geo.precision] : null)}</dl>
    <Link href={`/projects?id=${p.id}`} className="btn-primary btn-sm mt-3 inline-flex">Open project</Link>
  </div>);
}
