'use client';
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from './ui';

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
      {canEdit && <div className="flex gap-2">
        <input className="input" aria-label="Content name" placeholder="e.g. Building 1, Podium, Site works…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <select className="input w-40" aria-label="Content type" value={kind} onChange={(e) => setKind(e.target.value)}>{CONTENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
        <button className="btn-primary" disabled={busy || !name.trim()} onClick={add}>Add</button></div>}
    </div>
  );
}
