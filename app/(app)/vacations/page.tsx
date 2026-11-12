'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plane, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { AUTO_REPLY_TEXT, needsAutoReply, vacationDays } from '@/lib/vacations';

interface Req { id: string; employee_id: string; start_date: string; end_date: string; days: number; replacement_id: string | null; notes: string | null; location: string | null; auto_reply: boolean }

export default function VacationsPage() {
  const { me, data } = useApp(); const toast = useToast();
  const [rows, setRows] = useState<Req[] | null>(null); const [canReq, setCanReq] = useState(false); const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false); const [del, setDel] = useState<Req | null>(null);
  const load = useCallback(async () => { try { const r = await api<{ requests: Req[]; can_request: boolean; all: boolean }>('/api/vacations'); setRows(r.requests); setCanReq(r.can_request); setAll(r.all); } catch (e: any) { toast(e.message, 'err'); setRows((x) => x ?? []); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const emp = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const name = (id: string | null) => (id ? emp.get(id)?.name ?? '—' : '—');
  if (!rows) return <Spinner />;
  return (
    <div className="space-y-4">
      <PageHeader title="Vacations" subtitle={all ? 'Vacation requests of all employees' : 'Your vacation requests'} actions={canReq && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Request vacation</button>} />
      {rows.length === 0 ? <Empty title="No vacation requests yet" hint={canReq ? 'Use “Request vacation” to add one.' : undefined} /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">{all && <th className="p-2">Employee</th>}<th className="p-2">From</th><th className="p-2">To</th><th className="p-2">Days</th><th className="p-2">Replacement</th><th className="p-2">Notes for the replacement</th><th className="p-2">Location</th><th className="p-2">Auto reply</th><th className="p-2" /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-b border-slate-100 align-top">
            {all && <td className="p-2 font-medium">{name(r.employee_id)}</td>}
            <td className="p-2 whitespace-nowrap">{fmtDate(r.start_date)}</td><td className="p-2 whitespace-nowrap">{fmtDate(r.end_date)}</td><td className="p-2 font-semibold">{r.days}</td>
            <td className="p-2">{name(r.replacement_id)}</td><td className="max-w-xs whitespace-pre-wrap p-2">{r.notes || '—'}</td><td className="p-2">{r.location || '—'}</td>
            <td className="p-2">{needsAutoReply(r.days) ? (r.auto_reply ? 'Yes' : '—') : <span className="text-slate-300">n/a</span>}</td>
            <td className="p-2 text-right">{(me.role === 'admin' || r.employee_id === me.employee_id) && <button className="btn-ghost text-red-600" onClick={() => setDel(r)} aria-label="Delete request"><Trash2 size={16} /></button>}</td>
          </tr>)}</tbody></table></div>)}
      {adding && <RequestModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      <Confirm open={!!del} danger title="Delete vacation request" message={del ? `Delete the request ${fmtDate(del.start_date)} – ${fmtDate(del.end_date)}?` : ''} confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={async () => { try { await api(`/api/vacations/${del!.id}`, { method: 'DELETE' }); toast('Deleted'); setDel(null); load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>);
}

function RequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { me, data } = useApp(); const toast = useToast(); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ start_date: '', end_date: '', replacement_id: '', notes: '', location: '' }); const [ack, setAck] = useState(false);
  const days = vacationDays(f.start_date, f.end_date); const auto = needsAutoReply(days);
  const people = data.employees.filter((e) => e.id !== me.employee_id).sort((a, b) => a.name.localeCompare(b.name));
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.start_date || !f.end_date) { toast('Enter the start day and the end day', 'err'); return; }
    if (!days) { toast('The end day must not be before the start day', 'err'); return; }
    if (auto && !ack) { toast('Tick the automatic email reply statement', 'err'); return; }
    setBusy(true);
    try { await api('/api/vacations', { method: 'POST', body: { ...f, replacement_id: f.replacement_id || null, auto_reply: auto && ack } }); toast('Vacation requested'); onSaved(); } catch (e: any) { toast(e.message, 'err'); setBusy(false); }
  };
  return <Modal open wide onClose={onClose} title="Request vacation" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}><Plane size={16} />Submit request</button></>}>
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Start day"><input type="date" className="input" value={f.start_date} onChange={(e) => { set('start_date', e.target.value); if (f.end_date && e.target.value > f.end_date) set('end_date', e.target.value); }} /></Field>
        <Field label="End day"><input type="date" className="input" value={f.end_date} min={f.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} /></Field>
        <Field label="Number of days" hint="Calculated, both days included"><div className="input bg-slate-50 font-semibold">{days || '—'}</div></Field>
      </div>
      <Field label="Replacement"><select className="input" value={f.replacement_id} onChange={(e) => set('replacement_id', e.target.value)}><option value="">— Select —</option>{people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <Field label="Important notes to be followed by the replacement during the vacation"><textarea className="input min-h-24" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} /></Field>
      <Field label="Location during the vacation"><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} maxLength={300} /></Field>
      {auto && <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{AUTO_REPLY_TEXT}</span></label>}
    </div>
  </Modal>;
}
