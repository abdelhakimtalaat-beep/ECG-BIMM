'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronDown, ImageDown } from 'lucide-react';
import { ChartBox, VBar } from '@/components/charts';
import { Empty, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { AccReviews, type ReviewDetail } from '@/components/AccReviews';

type By = Record<string, number>;
interface Asg { key: string; name: string; kind: 'role' | 'user' | 'company' | 'none'; total: number; by_status: By }
interface Loc { key: string; name: string; building: string; total: number; by_status: By }
interface Cell { building: string; key: string; by_status: By }
interface Proj { id: string; name: string; project_no: string | null; acc_project_id: string; synced_at: string; assignees: Asg[] | null; locations: Loc[] | null; matrix: Cell[] | null; review_detail: ReviewDetail | null; total: number }
// Colours follow ACC: orange = open, green = completed, red = in dispute and not approved, cyan = pending, dark gray = closed
const COLS: [string, string, string][] = [['open', 'Open', '#F97316'], ['pending', 'Pending', '#06B6D4'], ['completed', 'Completed', '#16A34A'], ['in_dispute', 'In dispute', '#DC2626'], ['not_approved', 'Not approved', '#F87171'], ['closed', 'Closed', '#475569'], ['draft', 'Draft', '#CBD5E1']];
const KIND: Record<string, string> = { role: 'Role', user: 'Person', company: 'Company', none: '—' };
const sum = (m: By) => Object.values(m).reduce((s, v) => s + v, 0);
const other = (m: By) => sum(m) - COLS.reduce((s, [k]) => s + (m[k] ?? 0), 0);
const series = [...COLS.map(([, l]) => l), 'Other']; const colors = [...COLS.map(([, , c]) => c), '#E2E8F0'];
const row = (name: string, m: By) => ({ name, ...Object.fromEntries(COLS.map(([k, l]) => [l, m[k] ?? 0])), Other: other(m) });
/** A chart that keeps every bar readable: it scrolls sideways when there are many. */
const Wide = ({ n, children, cap }: { n: number; children: React.ReactNode; cap: boolean }) => <div className={`h-full ${cap ? '' : 'overflow-x-auto'}`}><div className="h-full" style={{ minWidth: Math.max(560, n * 72) }}>{children}</div></div>;
const Dot = ({ c }: { c: string }) => <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: c }} />;

export default function AccStatsPage() {
  const toast = useToast(); const [rows, setRows] = useState<Proj[] | null>(null); const [sel, setSel] = useState(''); const [kind, setKind] = useState('all'); const [tab, setTab] = useState<'issues' | 'reviews'>('issues'); const [view, setView] = useState<'assignee' | 'location'>('assignee'); const [bld, setBld] = useState('all'); const [cap, setCap] = useState<'chart' | 'table' | 'both' | null>(null); const [menu, setMenu] = useState(false); const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => { api<{ projects: Proj[] }>('/api/acc/assignees').then((r) => { setRows(r.projects); setSel(r.projects[0]?.id ?? ''); }).catch((e) => { toast(e.message, 'err'); setRows([]); }); }, [toast]);
  useEffect(() => { setBld('all'); }, [sel]);
  const p = rows?.find((x) => x.id === sel);
  const buildings = useMemo(() => [...new Set([...(p?.matrix ?? []).map((c) => c.building), ...(p?.locations ?? []).map((l) => l.building)])].sort((a, b) => (a === 'No location' ? 1 : 0) - (b === 'No location' ? 1 : 0) || a.localeCompare(b)), [p]);
  // every assignee of the project, with the counts of the chosen building (zeros included)
  const asg = useMemo(() => {
    if (!p?.assignees) return [];
    const inB = new Map<string, By>(); for (const c of p.matrix ?? []) if (bld === 'all' || c.building === bld) { const m: By = inB.get(c.key) ?? {}; for (const [k, v] of Object.entries(c.by_status)) m[k] = (m[k] ?? 0) + Number(v); inB.set(c.key, m); }
    return p.assignees.filter((a) => kind === 'all' || a.kind === kind).map((a) => { const m = bld === 'all' ? a.by_status : inB.get(a.key) ?? {}; return { ...a, by_status: m, total: sum(m) }; }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [p, bld, kind]);
  const locs = useMemo(() => (p?.locations ?? []).filter((l) => bld === 'all' || l.building === bld), [p, bld]);
  const exportJpg = async (what: 'chart' | 'table' | 'both') => {
    setMenu(false); setCap(what);
    try {
      await new Promise((res) => setTimeout(res, 450));                       // let the chart redraw at full width
      const node = exportRef.current; if (!node || !p) return;
      const { toJpeg } = await import('html-to-image');
      const url = await toJpeg(node, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a'); a.href = url; a.download = `ACC-${p.project_no ?? 'project'}-${view}-${what}-${new Date().toISOString().slice(0, 10)}.jpg`; a.click();
    } catch (e: any) { toast(`Could not create the image: ${e?.message ?? e}`, 'err'); } finally { setCap(null); }
  };
  if (!rows) return <Spinner />;
  const needMatrix = bld !== 'all' && view === 'assignee' && !p?.matrix;
  const shown = asg.reduce((s, a) => s + a.total, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="ACC Statistics" subtitle="Issues by assignee or location, and the reviews dashboard, from the ACC extract" actions={p && tab === 'issues' && (view === 'location' ? !!p.locations : !!p.assignees && !needMatrix) && <div className="relative">
        <button className="btn-secondary" disabled={!!cap} onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}><ImageDown size={16} />Export JPG<ChevronDown size={14} /></button>
        {menu && <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">{([['chart', 'Chart only'], ['table', 'Table only'], ['both', 'Chart and table']] as const).map(([k, l]) => <button key={k} role="menuitem" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => exportJpg(k)}>{l}</button>)}</div>}
      </div>} />
      {rows.length === 0 ? <Empty title="No ACC statistics yet" hint="The administrator uploads an ACC extract (Administration > ACC) and links the project to its ACC project." /> : <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Project</span><select className="input w-80" value={sel} onChange={(e) => setSel(e.target.value)}>{rows.map((x) => <option key={x.id} value={x.id}>{x.project_no ? `${x.project_no} — ` : ''}{x.name}</option>)}</select></label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm" role="tablist" aria-label="Dashboard">{([['issues', 'Issues'], ['reviews', 'Reviews']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`px-3 py-2 font-medium ${tab === k ? 'bg-brand-900 text-white' : 'bg-white hover:bg-slate-50'}`} onClick={() => setTab(k)}>{l}</button>)}</div>
          {tab === 'issues' && <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm" role="tablist" aria-label="View">{([['assignee', 'By assignee'], ['location', 'By location']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`px-3 py-2 ${view === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`} onClick={() => setView(k)}>{l}</button>)}</div>}
          {p && <p className="pb-2 text-xs text-slate-500">{tab === 'reviews' ? `${p.review_detail?.total ?? 0} reviews` : `${p.total} issues`} · extract of {fmtDate(p.synced_at)} (not live)</p>}
        </div>
        {p && tab === 'issues' && <section className="card flex flex-wrap items-end gap-4 p-3" aria-label="Filters">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Location filter (building / area)</span><select className="input w-64" value={bld} onChange={(e) => setBld(e.target.value)}><option value="all">All locations</option>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          {view === 'assignee' && <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Assigned to</span><select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Everyone</option><option value="role">Roles</option><option value="user">People</option></select></label>}
          <p className="pb-2 text-xs text-slate-500">{view === 'assignee' ? `Every assignee is listed${bld === 'all' ? '' : `; the numbers are the issues located in “${bld}”`}.` : 'The location filter limits the locations listed.'}</p>
        </section>}
        {p && tab === 'reviews' && <AccReviews d={p.review_detail} title={`${p.project_no ? `${p.project_no} — ` : ''}${p.name}`} file={p.project_no ?? 'project'} />}
        {tab === 'issues' && <div ref={exportRef} className={cap ? 'space-y-3 bg-white p-4' : 'space-y-4'} style={cap ? { width: 'max-content', minWidth: '100%' } : undefined}>
          <div className={cap ? 'block' : 'hidden'}><h2 className="text-lg font-semibold text-brand-900">ACC Statistics — {p?.project_no ? `${p.project_no} — ` : ''}{p?.name}</h2><p className="text-sm text-slate-600">Issues by {view} and status{bld === 'all' ? '' : ` · location: ${bld}`}{view === 'assignee' && kind !== 'all' ? ` · ${kind}s only` : ''} · ACC extract of {p ? fmtDate(p.synced_at) : ''}</p></div>
        {p && view === 'location' && (p.locations ? <>
          {(() => { const withLoc = p.locations.filter((l) => l.key !== '-' && l.building !== 'Unknown location').reduce((s, l) => s + l.total, 0); return <p className="text-xs text-amber-700">Only {withLoc} of {p.total} issues have a location in ACC; the rest are listed as “No location”.</p>; })()}
          <div className={cap === 'table' ? 'hidden' : ''}><ChartBox title="Issues by location and status" subtitle={`${locs.length} location(s)`} height={320}><Wide cap={!!cap} n={locs.length}><VBar data={locs.map((a) => row(a.name, a.by_status))} series={series} colors={colors} /></Wide></ChartBox></div>
          <div className={`card overflow-x-auto ${cap === 'chart' ? 'hidden' : ''}`}><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Location</th>{COLS.map(([, l, c]) => <th key={l} className="p-2 text-right"><Dot c={c} />{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{locs.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a.by_status)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
        </> : <Empty title="This project's statistics do not include locations" hint="Upload a new ACC extract (Administration > ACC) to add them." />)}
        {p && view === 'assignee' && !p.assignees && <Empty title="This project's statistics do not include assignees" hint="Upload a new ACC extract (Administration > ACC) to add them." />}
        {p?.assignees && view === 'assignee' && (needMatrix ? <Empty title="Upload the extract again to filter assignees by location" hint="The current import does not contain the assignee-by-location figures (Administration > ACC)." /> : <>
          <div className={cap === 'table' ? 'hidden' : ''}><ChartBox title="Issues by assignee and status" subtitle={`${asg.length} assignee(s)${bld === 'all' ? '' : ` · location: ${bld} · ${shown} issues`}`} height={340}><Wide cap={!!cap} n={asg.length}><VBar data={asg.map((a) => row(a.name, a.by_status))} series={series} colors={colors} /></Wide></ChartBox></div>
          <div className={`card overflow-x-auto ${cap === 'chart' ? 'hidden' : ''}`}><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Assignee</th><th className="p-2">Type</th>{COLS.map(([, l, c]) => <th key={l} className="p-2 text-right"><Dot c={c} />{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{asg.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td><td className="p-2 text-slate-500">{KIND[a.kind]}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a.by_status)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-500"><BarChart3 className="mr-1 inline" size={12} />Most issues are assigned to ACC roles (groups), so those rows are shown as roles; people appear when an issue is assigned to a named person.</p>
        </>)}
        </div>}
      </>}
    </div>);
}
