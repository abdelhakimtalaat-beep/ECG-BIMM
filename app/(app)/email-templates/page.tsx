'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Mail, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/client';
import { LONG_BODY, canChangeTemplate, mailtoLink, outlookWebLink } from '@/lib/emailTemplates';

interface Tpl { id: string; title: string; body: string; status: 'approved' | 'pending' | 'rejected'; requested_name: string | null; review_note: string | null; mine: boolean; requested_by: string | null }

export default function EmailTemplatesPage() {
  const { me } = useApp(); const toast = useToast(); const admin = me.role === 'admin';
  const [rows, setRows] = useState<Tpl[] | null>(null); const [text, setText] = useState('');
  const [form, setForm] = useState<Partial<Tpl> | null>(null); const [del, setDel] = useState<Tpl | null>(null); const [rev, setRev] = useState<Tpl | null>(null);
  const load = useCallback(async () => { try { setRows((await api<{ templates: Tpl[] }>('/api/email-templates')).templates); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const t = text.trim().toLowerCase();
  const match = (x: Tpl) => !t || x.title.toLowerCase().includes(t) || x.body.toLowerCase().includes(t);
  const approved = useMemo(() => (rows ?? []).filter((x) => x.status === 'approved' && match(x)), [rows, t]);
  const requests = useMemo(() => (rows ?? []).filter((x) => x.status !== 'approved'), [rows]);
  const copy = async (x: Tpl) => { try { await navigator.clipboard.writeText(`${x.title}\n\n${x.body}`); toast('Copied'); } catch { toast('Copy is not allowed in this browser', 'err'); } };
  const call = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); await load(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-4">
      <PageHeader title="Emails Template" subtitle={admin ? 'Publish e-mail templates for everyone and review the requests from engineers.' : 'Use a ready template in Outlook, or request a new one — the Administrator reviews it before it is published.'}
        actions={<button className="btn-primary" onClick={() => setForm({})}><Plus size={16} />{admin ? 'Add template' : 'Request new template'}</button>} />

      {requests.length > 0 && <section className="card border-amber-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-brand-900">{admin ? 'Requests to review' : 'My requests'}</h2>
        <div className="space-y-2">{requests.map((x) => (
          <div key={x.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2"><b className="text-sm text-brand-900">{x.title}</b><Badge tone={x.status === 'pending' ? 'amber' : 'red'}>{x.status === 'pending' ? 'waiting for review' : 'rejected'}</Badge>{admin && <span className="text-xs text-slate-500">requested by {x.requested_name ?? '—'}</span>}
              <span className="ml-auto flex gap-1">
                {admin && x.status === 'pending' && <><button className="btn-primary btn-sm" onClick={() => call(() => api(`/api/email-templates/${x.id}`, { method: 'PATCH', body: { status: 'approved', review_note: null } }), 'Template approved')}><Check size={14} />Approve</button><button className="btn-secondary btn-sm" onClick={() => setRev(x)}><X size={14} />Reject</button></>}
                {canChangeTemplate(x, me.role, me.email) && <><button className="btn-ghost btn-sm" aria-label="Edit" onClick={() => setForm(x)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-red-600" aria-label="Delete" onClick={() => setDel(x)}><Trash2 size={14} /></button></>}</span></div>
            {x.review_note && <p className="mt-1 text-xs text-red-700">Reviewer note: {x.review_note}</p>}
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans text-sm text-slate-700">{x.body}</pre></div>))}</div></section>}

      <div className="card flex flex-wrap items-end gap-3 p-3"><Field label="Search"><div className="relative"><Search size={14} className="absolute left-2.5 top-3 text-slate-400" /><input className="input w-72 pl-8" placeholder="Title or text…" value={text} onChange={(e) => setText(e.target.value)} /></div></Field>
        <p className="ml-auto text-sm text-slate-500">{approved.length} template{approved.length === 1 ? '' : 's'}</p></div>

      {!rows ? <Spinner /> : !approved.length ? <Empty title="No templates yet" hint={admin ? 'Use “Add template” to publish the first one.' : 'Request the first template with the button above.'} /> : (
        <div className="grid gap-4 lg:grid-cols-2">{approved.map((x) => (
          <article key={x.id} className="card flex flex-col p-4">
            <div className="flex items-start gap-2"><h3 className="flex-1 font-semibold text-brand-900">{x.title}</h3>{admin && <><button className="btn-ghost btn-sm" aria-label={`Edit ${x.title}`} onClick={() => setForm(x)}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-red-600" aria-label={`Delete ${x.title}`} onClick={() => setDel(x)}><Trash2 size={14} /></button></>}</div>
            <pre className="mt-2 max-h-56 flex-1 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 font-sans text-sm text-slate-700">{x.body}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn-primary btn-sm" href={mailtoLink(x.title, x.body)}><Mail size={14} />Open in Outlook</a>
              <a className="btn-secondary btn-sm" href={outlookWebLink(x.title, x.body)} target="_blank" rel="noreferrer"><ExternalLink size={14} />Outlook on the web</a>
              <button className="btn-secondary btn-sm" onClick={() => copy(x)}><Copy size={14} />Copy</button></div>
            {x.body.length > LONG_BODY && <p className="mt-2 text-xs text-amber-700">Long template: if Outlook cuts the text, use Copy and paste it into a new message.</p>}
          </article>))}</div>)}

      {form && <TemplateForm init={form} admin={admin} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); toast(msg); load(); }} />}
      <Confirm open={!!del} title="Delete template" message={`Delete "${del?.title}"?`} confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={() => { const x = del!; setDel(null); call(() => api(`/api/email-templates/${x.id}`, { method: 'DELETE' }), 'Deleted'); }} />
      {rev && <RejectModal tpl={rev} onClose={() => setRev(null)} onDone={() => { setRev(null); load(); }} />}
    </div>
  );
}

function TemplateForm({ init, admin, onClose, onSaved }: { init: Partial<Tpl>; admin: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const toast = useToast(); const isNew = !init.id;
  const [f, setF] = useState({ title: init.title ?? '', body: init.body ?? '' });
  const save = async () => { try {
    if (isNew) { const r: any = await api('/api/email-templates', { body: f }); onSaved(r.status === 'approved' ? 'Template added' : 'Request sent to the Administrator for review'); }
    else { await api(`/api/email-templates/${init.id}`, { method: 'PATCH', body: f }); onSaved('Saved'); }
  } catch (e: any) { toast(e.message, 'err'); } };
  return <Modal open onClose={onClose} wide title={isNew ? (admin ? 'Add template' : 'Request new template') : 'Edit template'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.title.trim() || !f.body.trim()} onClick={save}>{isNew && !admin ? 'Send request' : 'Save'}</button></>}>
    <div className="space-y-3">
      {!admin && <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">Your template is published only after the Administrator approves it.</p>}
      <Field label="Email title (subject)"><input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Email body" hint="Use [square brackets] for the parts the sender must fill in."><textarea rows={12} className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
    </div>
  </Modal>;
}

function RejectModal({ tpl, onClose, onDone }: { tpl: Tpl; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [note, setNote] = useState('');
  return <Modal open onClose={onClose} title={`Reject "${tpl.title}"`} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={async () => { try { await api(`/api/email-templates/${tpl.id}`, { method: 'PATCH', body: { status: 'rejected', review_note: note.trim() || null } }); toast('Request rejected'); onDone(); } catch (e: any) { toast(e.message, 'err'); } }}>Reject</button></>}>
    <Field label="Reason (shown to the engineer)"><textarea rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></Modal>;
}
