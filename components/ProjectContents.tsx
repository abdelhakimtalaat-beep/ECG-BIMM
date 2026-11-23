'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { Modal, useToast } from './ui';

export const CONTENT_KINDS = ['Building', 'Infrastructure', 'Landscape', 'Other'] as const;
interface Item { id: string; name: string; kind: string }

/** Project contents (buildings, infrastructure, landscape...). They feed the "add a building" list of the BIM Process Map. */
export function ProjectContents({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [name, setName] = useState(''); const [kind, setKind] = useState<string>('Building'); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setItems((await api(`/api/projects/${projectId}/contents`)).contents); } catch { setItems([]); } }, [projectId]);
  useEffect(() => { setItems(null); load(); }, [load]);
  const add = async () => {
    if (!name.trim()) return; setBusy(true);
    try { await api(`/api/projects/${projectId}/contents`, { body: { name: name.trim(), kind } }); setName(''); toast('Content added'); await load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const [acc, setAcc] = useState(false);
  const del = async (c: Item) => {
    if (!window.confirm(`Remove “${c.name}” from the project contents? Its process-map progress is removed too.`)) return;
    try { await api(`/api/projects/${projectId}/contents/${c.id}`, { method: 'DELETE' }); toast('Removed'); await load(); } catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <div><p className="label">Project contents</p>
      {!items ? <p className="text-sm text-slate-500">Loading…</p> : items.length ? (
        <ul className="mb-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {items.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5"><span>{c.name} <span className="text-xs text-slate-500">· {c.kind}</span></span>
            {canEdit && <button className="btn-ghost btn-sm" aria-label={`Remove ${c.name}`} onClick={() => del(c)}><Trash2 size={14} /></button>}</li>)}
        </ul>) : <p className="mb-2 text-sm text-slate-500">No contents yet.</p>}
      {canEdit && <button className="btn-secondary btn-sm mb-2" onClick={() => setAcc(true)} title="Read the buildings from the project's Locations in ACC"><Download size={14} />Read from ACC Locations</button>}
      {acc && <AccLocations projectId={projectId} onClose={() => setAcc(false)} onDone={() => { setAcc(false); load(); }} />}
      {canEdit && <div className="flex gap-2">
        <input className="input" aria-label="Content name" placeholder="e.g. Building 1, Podium, Site works…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <select className="input w-40" aria-label="Content type" value={kind} onChange={(e) => setKind(e.target.value)}>{CONTENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <button className="btn-primary" disabled={busy || !name.trim()} onClick={add}>Add</button></div>}
    </div>
  );
}

interface LocItem { id: string; name: string; depth: 1 | 2; parent: string | null; exists: boolean }
/** Choose what to read from the ACC Locations of the project: the first level, or the first two levels. */
function AccLocations({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [depth, setDepth] = useState<1 | 2>(1); const [kind, setKind] = useState<string>('Building');
  const [res, setRes] = useState<{ state: string; message?: string; items?: LocItem[] } | null>(null); const [err, setErr] = useState(''); const [pick, setPick] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false);
  useEffect(() => { let dead = false; setRes(null); setErr(''); setPick(new Set());
    api(`/api/projects/${projectId}/acc-locations?depth=${depth}`).then((r: any) => { if (dead) return; setRes(r); setPick(new Set((r.items ?? []).filter((x: LocItem) => !x.exists).map((x: LocItem) => x.id))); }).catch((e) => !dead && setErr(e.message)); return () => { dead = true; }; }, [projectId, depth]);
  const items = res?.items ?? []; const fresh = items.filter((x) => !x.exists);
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const run = async () => { setBusy(true); try { const r: any = await api(`/api/projects/${projectId}/acc-locations`, { body: { depth, ids: [...pick], kind } }); toast(`${r.added} added${r.skipped ? `, ${r.skipped} already existed` : ''}`); onDone(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (<Modal open onClose={onClose} title="Read from ACC Locations" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !pick.size} onClick={run}>Import {pick.size || ''} item{pick.size === 1 ? '' : 's'}</button></>}>
    <fieldset className="mb-3"><legend className="label">How much of the ACC Locations?</legend>
      <label className="mr-5 inline-flex items-center gap-2 text-sm"><input type="radio" name="depth" checked={depth === 1} onChange={() => setDepth(1)} />First level only <span className="text-xs text-slate-500">(buildings / zones)</span></label>
      <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="depth" checked={depth === 2} onChange={() => setDepth(2)} />Two levels <span className="text-xs text-slate-500">(buildings and what is inside them)</span></label></fieldset>
    {err ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>
      : !res ? <p className="text-sm text-slate-500">Reading the Locations from ACC…</p>
      : res.state === 'unlinked' ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This project is not linked to an ACC project yet. The ACC project name must start with the project number.</p>
      : res.state !== 'ready' ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{res.message}</p>
      : <>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-600">{items.length} found, {fresh.length} new</span>
          <button className="btn-ghost btn-sm" onClick={() => setPick(new Set(fresh.map((x) => x.id)))}>Select all new</button><button className="btn-ghost btn-sm" onClick={() => setPick(new Set())}>Clear</button>
          <label className="ml-auto flex items-center gap-2">Add as <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)}>{CONTENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label></div>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">{items.map((x) => (
          <li key={x.id}><label className={`flex items-center gap-2 px-3 py-1.5 ${x.depth === 2 ? 'pl-8' : 'bg-slate-50 font-medium'} ${x.exists ? 'text-slate-400' : ''}`}><input type="checkbox" className="h-4 w-4" disabled={x.exists} checked={pick.has(x.id)} onChange={() => toggle(x.id)} />
            <span className="min-w-0 flex-1 break-words">{x.depth === 2 ? x.name.slice((x.parent?.length ?? 0) + 3) : x.name}</span>{x.exists && <span className="text-xs">already added</span>}</label></li>))}</ul>
        <p className="mt-2 text-xs text-slate-500">{depth === 2 ? 'Second-level items are added as "Building - Level".' : 'Only the first level is read.'} Nothing is changed in ACC.</p></>}
  </Modal>);
}
