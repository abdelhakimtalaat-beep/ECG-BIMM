'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/client';

interface Contact { id: string; name: string; department: string | null; job_title: string | null; email: string | null; mobile: string | null; ext: string | null; notes: string | null; mine: boolean }
const BLANK = { name: '', department: '', job_title: '', email: '', mobile: '', ext: '', notes: '' };

export default function ContactsPage() {
  const { me } = useApp(); const toast = useToast();
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [text, setText] = useState(''); const [dept, setDept] = useState('all');
  const [form, setForm] = useState<Partial<Contact> | null>(null); const [del, setDel] = useState<Contact | null>(null);
  const load = useCallback(async () => { try { setRows((await api<{ contacts: Contact[] }>('/api/contacts')).contacts); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const depts = useMemo(() => [...new Set((rows ?? []).map((r) => r.department).filter(Boolean) as string[])].sort(), [rows]);
  const shown = useMemo(() => { const t = text.trim().toLowerCase(); return (rows ?? []).filter((r) => (dept === 'all' || r.department === dept) && (!t || [r.name, r.department, r.job_title, r.email, r.mobile, r.ext].some((v) => (v ?? '').toLowerCase().includes(t)))); }, [rows, text, dept]);
  const canChange = (c: Contact) => me.role === 'admin' || c.mine;

  return (
    <div className="space-y-4">
      <PageHeader title="Other Departments Contacts" subtitle="Colleagues outside the BIM Department. Anyone can add a contact; you can edit or delete the contacts you added (the Administrator can change all)."
        actions={<button className="btn-primary" onClick={() => setForm({})}><Plus size={16} />Add contact</button>} />
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <Field label="Search"><div className="relative"><Search size={14} className="absolute left-2.5 top-3 text-slate-400" /><input className="input w-64 pl-8" placeholder="Name, department, phone…" value={text} onChange={(e) => setText(e.target.value)} /></div></Field>
        <Field label="Department"><select className="input w-52" value={dept} onChange={(e) => setDept(e.target.value)}><option value="all">All</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <p className="ml-auto text-sm text-slate-500">{shown.length} contact{shown.length === 1 ? '' : 's'}</p>
      </div>
      {!rows ? <Spinner /> : !shown.length ? <Empty title="No contacts" hint="Use “Add contact” to add the first one." /> : (
        <div className="card overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Name', 'Department', 'Job title', 'Mobile', 'Ext.', 'Email', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{shown.map((c) => (
          <tr key={c.id} className="border-t border-slate-100">
            <td className="td font-medium text-brand-900">{c.name}{c.notes && <div className="text-xs font-normal text-slate-500">{c.notes}</div>}</td>
            <td className="td">{c.department ?? '—'}</td><td className="td">{c.job_title ?? '—'}</td>
            <td className="td">{c.mobile ? <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={`tel:${c.mobile.replace(/[^+\d]/g, '')}`}><Phone size={13} />{c.mobile}</a> : '—'}</td>
            <td className="td">{c.ext ?? '—'}</td>
            <td className="td">{c.email ? <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={`mailto:${c.email}`}><Mail size={13} />{c.email}</a> : '—'}</td>
            <td className="td whitespace-nowrap">{canChange(c) && <><button className="btn-secondary btn-sm mr-1" aria-label={`Edit ${c.name}`} onClick={() => setForm(c)}><Pencil size={14} /></button><button className="btn-secondary btn-sm" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 size={14} /></button></>}</td></tr>))}</tbody></table></div>)}
      {form && <ContactForm init={form} depts={depts} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      <Confirm open={!!del} title="Delete contact" message={`Delete "${del?.name}"?`} confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={async () => { const c = del!; setDel(null); try { await api(`/api/contacts/${c.id}`, { method: 'DELETE' }); toast('Contact deleted'); load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>
  );
}

function ContactForm({ init, depts, onClose, onSaved }: { init: Partial<Contact>; depts: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const isNew = !init.id;
  const [f, setF] = useState({ ...BLANK, ...Object.fromEntries(Object.entries(init).filter(([k]) => k in BLANK).map(([k, v]) => [k, v ?? ''])) });
  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api(isNew ? '/api/contacts' : `/api/contacts/${init.id}`, { method: isNew ? 'POST' : 'PATCH', body: f }); toast(isNew ? 'Contact added' : 'Contact updated'); onSaved(); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add contact' : 'Edit contact'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.name.trim()} onClick={save}>{isNew ? 'Add' : 'Save'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Full name"><input className="input" value={f.name} onChange={set('name')} /></Field></div>
        <Field label="Department"><input className="input" list="dept-list" value={f.department} onChange={set('department')} /><datalist id="dept-list">{depts.map((d) => <option key={d} value={d} />)}</datalist></Field>
        <Field label="Job title"><input className="input" value={f.job_title} onChange={set('job_title')} /></Field>
        <Field label="Mobile no."><input type="tel" className="input" value={f.mobile} onChange={set('mobile')} /></Field>
        <Field label="Ext. no."><input className="input" value={f.ext} onChange={set('ext')} /></Field>
        <div className="col-span-2"><Field label="Email"><input type="email" className="input" value={f.email} onChange={set('email')} /></Field></div>
        <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
    </Modal>
  );
}
