'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, SearchBox, Spinner, useToast } from '@/components/ui';
import { api, fmtDateTime } from '@/lib/client';
import { PRIORITIES, SOFTWARE, STATUS_LABEL, TICKET_STATUSES, canAnswer, canAssign, canReopen, canResolve, canReturn, isAdmin, priorityRank, ticketNo, validateNew } from '@/lib/tickets';

interface Row { id: string; ticket_no: number; project_name: string; software: string; title: string; priority: string; status: string; requester_id: string | null; requester_name: string; assignee_id: string | null; assignee_name: string | null; created_at: string; updated_at: string }
interface Detail extends Row { problem: string; extension: string; mobile: string | null; requester_email: string | null; image_id: string | null; draft_answer?: string | null; draft_image_id?: string | null; draft_by?: string | null; final_answer: string | null; final_image_id: string | null; resolved_by: string | null; resolved_at: string | null }
interface Eng { id: string; name: string; role: string }
const PTONE: Record<string, 'gray' | 'blue' | 'amber' | 'red'> = { Low: 'gray', Medium: 'blue', High: 'amber', Urgent: 'red' };
const STONE: Record<string, 'gray' | 'blue' | 'amber' | 'green'> = { New: 'gray', Assigned: 'blue', Answered: 'amber', Resolved: 'green' };
const ROLE: Record<string, string> = { bim_manager: 'BIM Manager', bim_coordinator: 'BIM Coordinator', bim_specialist: 'BIM Specialist' };

/** A screenshot is shrunk to 1600 px (JPEG) before it is uploaded; the server returns its id. */
async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('Choose a PNG, JPEG or WebP image');
  const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k)); const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/jpeg', 0.85));
  return (await api<{ id: string }>('/api/tickets/image', { method: 'POST', raw: blob, headers: { 'Content-Type': 'image/jpeg', 'x-filename': encodeURIComponent(file.name.replace(/\.\w+$/, '') + '.jpg') } })).id;
}
/** Attach-image button with a small preview. `value` is the uploaded image id. */
function ImagePick({ value, onChange, label = 'Attach image' }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const toast = useToast(); const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false);
  return (<div className="flex items-start gap-3">
    <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { onChange(await uploadImage(f)); } catch (x: any) { toast(x.message, 'err'); } finally { setBusy(false); } }} />
    <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}><ImagePlus size={14} />{busy ? 'Uploading…' : value ? 'Change image' : label}</button>
    {value && <><a href={`/api/files/${value}`} target="_blank" rel="noopener noreferrer"><img src={`/api/files/${value}`} alt="Attached" className="h-16 rounded border border-slate-200 object-cover" /></a><button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}><Trash2 size={14} />Remove</button></>}</div>);
}
const Img = ({ id }: { id: string | null | undefined }) => id ? <a href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="mt-2 block"><img src={`/api/files/${id}`} alt="Attached" className="max-h-64 rounded border border-slate-200" /></a> : null;

export default function TroubleshootingPage() {
  const { me } = useApp(); const toast = useToast(); const admin = isAdmin(me);
  const [rows, setRows] = useState<Row[] | null>(null); const [eng, setEng] = useState<Eng[]>([]); const [status, setStatus] = useState('all'); const [q, setQ] = useState(''); const [add, setAdd] = useState(false); const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => { try { const r = await api<{ tickets: Row[]; engineers: Eng[] }>('/api/tickets'); setRows(r.tickets); setEng(r.engineers); } catch (e: any) { toast(e.message, 'err'); setRows([]); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => (rows ?? []).filter((t) => (status === 'all' || t.status === status) && (!q || `${ticketNo(t.ticket_no)} ${t.title} ${t.project_name} ${t.requester_name} ${t.assignee_name ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(a.status === 'Resolved') - Number(b.status === 'Resolved') || priorityRank(b.priority) - priorityRank(a.priority) || b.created_at.localeCompare(a.created_at)), [rows, status, q]);
  const count = (s: string) => (rows ?? []).filter((t) => t.status === s).length;
  const todo = admin ? count('New') + count('Answered') : (rows ?? []).filter((t) => t.status === 'Assigned' && t.assignee_id === me.id).length;
  return (<div className="space-y-4">
    <PageHeader title="Troubleshooting" subtitle={rows ? `${rows.length} quer${rows.length === 1 ? 'y' : 'ies'}${todo ? ` · ${todo} need${todo === 1 ? 's' : ''} your action` : ''}` : 'Loading…'} actions={<button className="btn-primary" onClick={() => setAdd(true)}><Plus size={16} />New query</button>} />
    <div className="card flex flex-wrap items-center gap-2 p-3"><SearchBox value={q} onChange={setQ} placeholder="Search queries" />
      {['all', ...TICKET_STATUSES].map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`rounded-full border px-3 py-1 text-sm ${status === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{s === 'all' ? 'All' : STATUS_LABEL[s]}{s !== 'all' && rows ? ` (${count(s)})` : ''}</button>)}</div>
    {!rows ? <Spinner label="Loading" /> : !shown.length ? <Empty title={rows.length ? 'No query matches' : 'No queries yet'} hint={rows.length ? 'Change the search or the status.' : admin ? 'Queries sent by users appear here. You transfer each one to a BIM Manager, Coordinator or Specialist.' : 'Press "New query" to send a problem you are facing to the BIM Department.'} />
      : <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">No.</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Project</th><th className="px-3 py-2">Software</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Assigned to</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Date</th></tr></thead>
        <tbody>{shown.map((t) => <tr key={t.id} tabIndex={0} onClick={() => setOpenId(t.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(t.id)} className="cursor-pointer border-b border-slate-100 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none">
          <td className="whitespace-nowrap px-3 py-2 font-medium text-brand-700">{ticketNo(t.ticket_no)}</td><td className="min-w-[14rem] px-3 py-2 font-medium">{t.title}</td><td className="min-w-[10rem] px-3 py-2">{t.project_name}</td><td className="px-3 py-2">{t.software}</td><td className="px-3 py-2"><Badge tone={PTONE[t.priority]}>{t.priority}</Badge></td><td className="px-3 py-2">{t.requester_name}</td><td className="px-3 py-2">{t.assignee_name ?? <span className="text-slate-400">—</span>}</td><td className="px-3 py-2"><Badge tone={STONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></td><td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDateTime(new Date(t.created_at))}</td></tr>)}</tbody></table></div>}
    {add && <NewQuery onClose={() => setAdd(false)} onDone={async () => { setAdd(false); await load(); }} />}
    {openId && <TicketModal id={openId} eng={eng} onClose={() => setOpenId(null)} onChanged={load} />}
  </div>);
}

function NewQuery({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data } = useApp(); const toast = useToast(); const [busy, setBusy] = useState(false); const [img, setImg] = useState<string | null>(null);
  const [f, setF] = useState({ project_id: '', software: '', title: '', problem: '', priority: '', extension: '', mobile: '' });
  const projects = useMemo(() => [...data.projects].sort((a, b) => `${a.project_no ?? ''} ${a.name}`.localeCompare(`${b.project_no ?? ''} ${b.name}`, undefined, { numeric: true })), [data.projects]);
  const bad = validateNew(f); const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const send = async () => { setBusy(true); try { const r: any = await api('/api/tickets', { body: { ...f, mobile: f.mobile.trim() || null, image_id: img } }); toast(`Query ${ticketNo(r.ticket_no)} sent. You will get the answer by e-mail${r.mail?.receipt === 'sent' ? ' (a receipt was e-mailed to you)' : ''}`); onDone(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (<Modal open onClose={onClose} wide title="New troubleshooting query" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!!bad || busy} onClick={send} title={bad ?? undefined}>{busy ? 'Sending…' : 'Send'}</button></>}>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Project *"><select className="input" value={f.project_id} onChange={set('project_id')}><option value="">— select a project —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.project_no ? `${p.project_no} · ` : ''}{p.name}</option>)}</select></Field>
      <Field label="Software *"><select className="input" value={f.software} onChange={set('software')}><option value="">— select the software —</option>{SOFTWARE.map((s) => <option key={s}>{s}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field label="Title *"><input className="input" maxLength={200} value={f.title} onChange={set('title')} placeholder="Short summary of the problem" /></Field></div>
      <div className="sm:col-span-2"><Field label="Problem *"><textarea rows={5} className="input" maxLength={6000} value={f.problem} onChange={set('problem')} placeholder="What happened, what you expected, the steps to repeat it, any error message" /></Field></div>
      <Field label="Priority *"><select className="input" value={f.priority} onChange={set('priority')}><option value="">— select the priority —</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
      <Field label="Extension *"><input className="input" inputMode="numeric" maxLength={20} value={f.extension} onChange={set('extension')} placeholder="e.g. 1234" /></Field>
      <Field label="Mobile No. (optional)"><input className="input" inputMode="tel" maxLength={25} value={f.mobile} onChange={set('mobile')} placeholder="e.g. 0100 000 0000" /></Field>
      <div><p className="label">Image (optional)</p><ImagePick value={img} onChange={setImg} label="Attach image" /></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">Fields marked * are required. The BIM Department transfers the query to the right engineer, reviews the answer and e-mails it to you.</p>
  </Modal>);
}

function TicketModal({ id, eng, onClose, onChanged }: { id: string; eng: Eng[]; onClose: () => void; onChanged: () => Promise<any> | void }) {
  const { me } = useApp(); const toast = useToast(); const admin = isAdmin(me);
  const [d, setD] = useState<{ ticket: Detail; events: { at: string; by_name: string; action: string; note: string | null }[] } | null>(null); const [busy, setBusy] = useState(false); const [del, setDel] = useState(false);
  const [assignee, setAssignee] = useState(''); const [text, setText] = useState(''); const [img, setImg] = useState<string | null>(null); const [note, setNote] = useState('');
  const refresh = useCallback(async () => { const r = await api<any>(`/api/tickets/${id}`); setD(r); const t: Detail = r.ticket; setAssignee(t.assignee_id ?? ''); setText(t.status === 'Answered' ? t.draft_answer ?? '' : ''); setImg(t.status === 'Answered' ? t.draft_image_id ?? null : null); setNote(''); }, [id]);
  useEffect(() => { refresh().catch((e) => { toast(e.message, 'err'); onClose(); }); }, [refresh]);   // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (body: any, ok: string, close = false) => { setBusy(true); try { const r: any = await api(`/api/tickets/${id}`, { method: 'PATCH', body }); toast(ok + (r?.mail === 'failed' ? ' (the e-mail could not be sent)' : r?.mail === 'off' ? ' (e-mail is not set up)' : '')); await onChanged(); if (close) onClose(); else await refresh(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  if (!d) return <Modal open onClose={onClose} title="Query" footer={<button className="btn-secondary" onClick={onClose}>Close</button>}><Spinner label="Loading" /></Modal>;
  const t = d.ticket; const u = { id: me.id, role: me.role }; const lite = { status: t.status, requester_id: t.requester_id, assignee_id: t.assignee_id };
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex gap-2 py-0.5 text-sm"><dt className="w-28 shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 flex-1 break-words">{v}</dd></div> : null;
  return (<Modal open onClose={onClose} wide title={`${ticketNo(t.ticket_no)} · ${t.title}`} footer={<><button className="btn-secondary" onClick={onClose}>Close</button>{admin && <button className="btn-danger ml-auto" onClick={() => setDel(true)}><Trash2 size={14} />Delete</button>}</>}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone={STONE[t.status]}>{STATUS_LABEL[t.status]}</Badge><Badge tone={PTONE[t.priority]}>{t.priority}</Badge></div>
    <dl>{row('Project', t.project_name)}{row('Software', t.software)}{row('From', `${t.requester_name}${t.requester_email ? ` (${t.requester_email})` : ''}`)}{row('Extension', t.extension)}{row('Mobile', t.mobile)}{row('Assigned to', t.assignee_name)}{row('Sent', fmtDateTime(new Date(t.created_at)))}</dl>
    <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="label">Problem</p><p className="whitespace-pre-wrap text-sm">{t.problem}</p><Img id={t.image_id} /></div>

    {t.status === 'Resolved' && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="label">Answer {t.resolved_by ? `(confirmed by ${t.resolved_by})` : ''}</p><p className="whitespace-pre-wrap text-sm">{t.final_answer}</p><Img id={t.final_image_id} />
      {canReopen(u, lite) && <div className="mt-3 border-t border-emerald-200 pt-3"><Field label="The problem is not solved? Tell us why"><textarea rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field><button className="btn-secondary btn-sm mt-2" disabled={busy || note.trim().length < 3} onClick={() => run({ action: 'reopen', note }, 'Query reopened')}>Reopen</button></div>}</div>}

    {canAssign(u, lite) && <div className="mt-3 rounded-lg border border-slate-200 p-3"><p className="label">Transfer to</p><div className="flex flex-wrap gap-2"><select className="input w-72" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Transfer to"><option value="">— choose an engineer —</option>{(['bim_manager', 'bim_coordinator', 'bim_specialist'] as const).map((r) => <optgroup key={r} label={ROLE[r]}>{eng.filter((x) => x.role === r).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select>
      <button className="btn-primary btn-sm" disabled={busy || !assignee || assignee === t.assignee_id} onClick={() => run({ action: 'assign', assignee_id: assignee }, `Transferred. The engineer was e-mailed`)}>{t.assignee_id ? 'Transfer again' : 'Transfer'}</button></div></div>}

    {t.status === 'Answered' && admin && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3"><p className="label">Answer by {t.draft_by ?? 'the engineer'}: review, edit and confirm</p>
      <textarea rows={6} className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Answer to send to the requester" /><div className="mt-2"><ImagePick value={img} onChange={setImg} label="Attach image" /></div>
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary" disabled={busy || text.trim().length < 3} onClick={() => run({ action: 'resolve', text, image_id: img }, 'Answer sent to the requester by e-mail', true)}>Confirm and send to {t.requester_name}</button></div>
      {canReturn(u, lite) && <div className="mt-3 border-t border-amber-300 pt-3"><Field label="Not good enough? Return it to the engineer with a note"><textarea rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field><button className="btn-secondary btn-sm mt-2" disabled={busy || note.trim().length < 3} onClick={() => run({ action: 'return', note }, 'Returned to the engineer')}>Return to {t.assignee_name}</button></div>}</div>}
    {t.status === 'Answered' && !admin && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your answer was sent to the Administrator for review. It reaches the requester after it is confirmed.{t.draft_answer ? <span className="mt-2 block whitespace-pre-wrap text-slate-700">{t.draft_answer}</span> : null}<Img id={t.draft_image_id} /></p>}

    {t.status !== 'Answered' && canAnswer(u, lite) && <div className="mt-3 rounded-lg border border-slate-200 p-3"><p className="label">{admin ? 'Answer it yourself (you confirm it right away)' : 'Your answer (the Administrator reviews it before it is sent)'}</p>
      <textarea rows={5} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Explain the solution step by step" aria-label="Your answer" /><div className="mt-2"><ImagePick value={img} onChange={setImg} label="Attach image to the answer" /></div>
      <div className="mt-3 flex flex-wrap gap-2">{!admin && <button className="btn-primary" disabled={busy || text.trim().length < 3} onClick={() => run({ action: 'answer', text, image_id: img }, 'Answer sent to the Administrator for review', true)}>Send to the Administrator for review</button>}
        {admin && <><button className="btn-primary" disabled={busy || text.trim().length < 3} onClick={() => run({ action: 'resolve', text, image_id: img }, 'Answer sent to the requester by e-mail', true)}>Send to {t.requester_name} now</button><button className="btn-secondary" disabled={busy || text.trim().length < 3} onClick={() => run({ action: 'answer', text, image_id: img }, 'Saved for review')}>Save as draft for review</button></>}</div></div>}

    <div className="mt-4"><p className="label">History</p><ol className="space-y-1.5 border-l-2 border-slate-200 pl-3 text-sm">{d.events.map((e, i) => <li key={i}><span className="font-medium">{e.action}</span> <span className="text-slate-500">· {e.by_name} · {fmtDateTime(new Date(e.at))}</span>{e.note && <p className="whitespace-pre-wrap text-slate-600">{e.note}</p>}</li>)}</ol></div>
    <Confirm open={del} title="Delete query" message={`Delete ${ticketNo(t.ticket_no)} and its images?`} confirmLabel="Delete" danger onClose={() => setDel(false)} onConfirm={async () => { setDel(false); try { await api(`/api/tickets/${id}`, { method: 'DELETE' }); toast('Query deleted'); await onChanged(); onClose(); } catch (e: any) { toast(e.message, 'err'); } }} />
  </Modal>);
}
