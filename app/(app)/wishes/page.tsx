'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Pencil, Plus, ThumbsUp, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { WISH_AREAS, WISH_STATUSES, canManageWish, sortWishes } from '@/lib/wishes';

interface Wish { id: string; title: string; description: string | null; area: string | null; author_name: string; status: string; admin_note: string | null; created_at: string; votes: number; voted: boolean; mine: boolean }
const TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = { New: 'gray', 'Under review': 'blue', Planned: 'amber', Done: 'green', Declined: 'red' };

export default function WishesPage() {
  const { me } = useApp(); const toast = useToast();
  const [rows, setRows] = useState<Wish[] | null>(null);
  const [status, setStatus] = useState('all'); const [by, setBy] = useState<'votes' | 'newest'>('votes');
  const [form, setForm] = useState<Partial<Wish> | null>(null); const [del, setDel] = useState<Wish | null>(null);
  const admin = canManageWish(me.role);

  const load = useCallback(async () => { try { setRows((await api<{ wishes: Wish[] }>('/api/wishes')).wishes); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const call = async (fn: () => Promise<any>, msg?: string) => { try { await fn(); if (msg) toast(msg); await load(); } catch (e: any) { toast(e.message, 'err'); } };
  const shown = useMemo(() => sortWishes((rows ?? []).filter((w) => status === 'all' || w.status === status), by), [rows, status, by]);

  return (
    <div className="space-y-4">
      <PageHeader title="Wish List" subtitle="Propose ideas to improve this platform. Vote for the ideas you like; the Administrator reviews them and updates their status."
        actions={<button className="btn-primary" onClick={() => setForm({})}><Plus size={16} />Propose an idea</button>} />
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <Field label="Status"><select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{WISH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Sort by"><select className="input w-40" value={by} onChange={(e) => setBy(e.target.value as any)}><option value="votes">Most votes</option><option value="newest">Newest</option></select></Field>
        <span className="ml-auto text-sm text-slate-500">{rows ? `${shown.length} idea${shown.length === 1 ? '' : 's'}` : ''}</span>
      </div>
      {!rows ? <Spinner /> : !shown.length ? <Empty title="No ideas yet" hint="Be the first to propose one." /> : (
        <ul className="space-y-3">{shown.map((w) => (
          <li key={w.id} className="card flex gap-3 p-4">
            <button onClick={() => call(() => api(`/api/wishes/${w.id}/vote`, { method: 'POST', body: {} }))} aria-pressed={w.voted} aria-label={`${w.voted ? 'Remove vote from' : 'Vote for'} ${w.title}`}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition ${w.voted ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}>
              <ThumbsUp size={16} />{w.votes}</button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Lightbulb size={15} className="text-amber-500" /><b className="text-brand-900">{w.title}</b><Badge tone={TONE[w.status] ?? 'gray'}>{w.status}</Badge>{w.area && <Badge tone="blue">{w.area}</Badge>}</div>
              {w.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{w.description}</p>}
              <p className="mt-1 text-xs text-slate-500">{w.author_name} · {fmtDate(w.created_at)}</p>
              {w.admin_note && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm text-brand-900"><b>Administrator:</b> {w.admin_note}</p>}
              {admin && <div className="mt-2 flex flex-wrap items-center gap-2">
                <select className="input w-40" aria-label="Status" value={w.status} onChange={(e) => call(() => api(`/api/wishes/${w.id}`, { method: 'PATCH', body: { status: e.target.value } }))}>{WISH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                <button className="btn-secondary btn-sm" onClick={() => setForm(w)}>Reply / edit</button></div>}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {!admin && w.mine && w.status === 'New' && <><button className="btn-ghost btn-sm" aria-label="Edit idea" onClick={() => setForm(w)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-red-600" aria-label="Delete idea" onClick={() => setDel(w)}><Trash2 size={14} /></button></>}
              {admin && <button className="btn-ghost btn-sm text-red-600" aria-label="Delete idea" onClick={() => setDel(w)}><Trash2 size={14} /></button>}
            </div>
          </li>))}</ul>)}
      {form && <WishForm init={form} admin={admin} onClose={() => setForm(null)} onDone={async (m) => { setForm(null); toast(m); await load(); }} />}
      <Confirm open={!!del} title="Delete idea" message={`Delete "${del?.title}"?`} confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={() => { const w = del!; setDel(null); call(() => api(`/api/wishes/${w.id}`, { method: 'DELETE' }), 'Idea deleted'); }} />
    </div>
  );
}

function WishForm({ init, admin, onClose, onDone }: { init: Partial<Wish>; admin: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const toast = useToast(); const isNew = !init.id;
  const own = isNew || (init.status === 'New' && !!init.mine); // the author edits the idea itself; the Administrator replies
  const [f, setF] = useState({ title: init.title ?? '', description: init.description ?? '', area: init.area ?? '', admin_note: init.admin_note ?? '' });
  const save = async () => {
    try {
      if (isNew) { await api('/api/wishes', { body: { title: f.title, description: f.description || null, area: f.area || null } }); onDone('Thank you — your idea was added'); return; }
      const body: any = {}; if (own || admin) { body.title = f.title; body.description = f.description || null; body.area = f.area || null; } if (admin) body.admin_note = f.admin_note || null;
      await api(`/api/wishes/${init.id}`, { method: 'PATCH', body }); onDone('Saved');
    } catch (e: any) { toast(e.message, 'err'); }
  };
  return <Modal open onClose={onClose} title={isNew ? 'Propose an idea' : 'Edit idea'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={f.title.trim().length < 3} onClick={save}>{isNew ? 'Submit' : 'Save'}</button></>}>
    <div className="grid grid-cols-1 gap-3">
      <Field label="Idea (short title)"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} disabled={!isNew && !own && !admin} /></Field>
      <Field label="Platform area"><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} disabled={!isNew && !own && !admin}><option value="">—</option>{WISH_AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
      <Field label="Details (what would it do, and why is it useful?)"><textarea rows={5} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} disabled={!isNew && !own && !admin} /></Field>
      {admin && !isNew && <Field label="Administrator reply (visible to everyone)"><textarea rows={3} className="input" value={f.admin_note} onChange={(e) => setF({ ...f, admin_note: e.target.value })} /></Field>}
    </div>
  </Modal>;
}
