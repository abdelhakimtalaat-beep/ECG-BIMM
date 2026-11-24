'use client';
import { useCallback, useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/client';
import { Spinner, useToast } from './ui';

interface U { id: string; name: string; email: string; role: string }
const ROLE: Record<string, string> = { admin: 'Administrator', bim_manager: 'BIM Manager', bim_coordinator: 'BIM Coordinator', bim_specialist: 'BIM Specialist', rd_engineer: 'R&D Engineer', viewer: 'Read only' };
/** Administration > BIM Ticket reviewers: who reviews, edits and confirms the answers before they are e-mailed to the requester. */
export function TicketReviewersAdmin() {
  const toast = useToast(); const [d, setD] = useState<{ ids: string[]; users: U[] } | null>(null); const [pick, setPick] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<{ ids: string[]; users: U[] }>('/api/ticket-reviewers').then(setD).catch((e) => toast(e.message, 'err')), [toast]); useEffect(() => { load(); }, [load]);
  const save = async (ids: string[], msg: string) => { setBusy(true); try { await api('/api/ticket-reviewers', { method: 'PUT', body: { ids } }); toast(msg); setPick(''); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  if (!d) return <Spinner label="Loading" />;
  const by = new Map(d.users.map((u) => [u.id, u])); const reviewers = d.ids.map((i) => by.get(i)).filter((u): u is U => !!u); const free = d.users.filter((u) => u.role !== 'admin' && !d.ids.includes(u.id));
  return (<div className="space-y-4">
    <div className="card p-4"><h3 className="mb-1 font-semibold text-brand-900">BIM Ticket reviewers</h3>
      <p className="mb-3 text-sm text-slate-600">A reviewer sees every BIM ticket, and reviews, edits and confirms the answers that engineers send, before they are e-mailed to the requester. Reviewers also get the "answer waiting for review" e-mail. Only the Administrator transfers tickets to engineers or deletes them. Administrators are always reviewers.</p>
      <div className="flex flex-wrap gap-2"><select className="input w-80" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a reviewer"><option value="">— choose a user to add —</option>{free.map((u) => <option key={u.id} value={u.id}>{u.name} ({ROLE[u.role] ?? u.role})</option>)}</select>
        <button className="btn-primary" disabled={!pick || busy} onClick={() => save([...d.ids, pick], 'Reviewer added')}><UserPlus size={16} />Add reviewer</button></div></div>
    <div className="card p-0">{reviewers.length ? <ul className="divide-y divide-slate-100 text-sm">{reviewers.map((u) => <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2"><span><span className="font-medium">{u.name}</span> <span className="text-slate-500">· {u.email} · {ROLE[u.role] ?? u.role}</span></span>
      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => save(d.ids.filter((i) => i !== u.id), 'Reviewer removed')}><Trash2 size={14} />Remove</button></li>)}</ul> : <p className="p-4 text-sm text-slate-500">No extra reviewers yet. Only the Administrators review BIM tickets.</p>}</div>
    <p className="text-xs text-slate-500">A read-only user limited to chosen tabs also needs the "BIM Ticket" tab ticked in his tab settings to open it.</p>
  </div>);
}
