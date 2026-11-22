'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ImagePlus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, Modal, PageHeader, SearchBox, StatusBadge, useToast } from '@/components/ui';
import { api } from '@/lib/client';
import { clientKey } from '@/lib/clients';
import { COUNTRIES } from '@/lib/countries';
import type { ClientRow } from '@/lib/types';

/** A logo is shrunk to 600 px and kept as PNG so a transparent background stays transparent. */
async function logoBlob(file: File): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('Choose a PNG, JPEG or WebP image');
  const bmp = await createImageBitmap(file); const k = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k)); c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/png'));
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
function Logo({ c, size = 'h-24' }: { c: ClientRow; size?: string }) {
  return <div className={`flex ${size} w-full items-center justify-center overflow-hidden rounded-lg bg-white`}>{c.logo_id ? <img src={`/api/files/${c.logo_id}`} alt={`${c.name} logo`} className="max-h-full max-w-full object-contain p-2" loading="lazy" />
    : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700" aria-hidden>{initials(c.name) || <Building2 size={24} />}</span>}</div>;
}

function Inner() {
  const { me, data, refresh } = useApp(); const toast = useToast(); const sp = useSearchParams();
  const canEdit = me.role === 'admin' || me.role === 'bim_manager';
  const [q, setQ] = useState(''); const [country, setCountry] = useState(''); const [openId, setOpenId] = useState<string | null>(sp.get('id')); const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { setOpenId(sp.get('id')); }, [sp]);
  const clients = data.clients ?? [];
  const projectsOf = useMemo(() => { const m = new Map<string, typeof data.projects>(); for (const p of data.projects) { const k = clientKey(p.client); if (k) m.set(k, [...(m.get(k) ?? []), p]); } return m; }, [data.projects]);
  const countries = useMemo(() => [...new Set(clients.map((c) => c.country).filter(Boolean) as string[])].sort(), [clients]);
  const shown = useMemo(() => clients.filter((c) => (!country || c.country === country) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))), [clients, q, country]);
  const noClient = useMemo(() => data.projects.filter((p) => !clientKey(p.client)).length, [data.projects]);
  const unlinked = useMemo(() => { const have = new Set(clients.map((c) => c.key)); return [...projectsOf.keys()].filter((k) => !have.has(k)).length; }, [clients, projectsOf]);
  const cur = openId ? clients.find((c) => c.id === openId) ?? null : null;

  const collect = async () => { setBusy(true); try { const r = await api<{ created: number; unified: number; clients: number; projects: number }>('/api/clients/collect', { method: 'POST' }); await refresh(); toast(`${r.clients} clients found in ${r.projects} projects: ${r.created} new, ${r.unified} project name(s) unified`); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };

  return (<>
    <PageHeader title="Clients" subtitle={`${clients.length} clients · ${data.projects.length - noClient} of ${data.projects.length} projects have a client${unlinked ? ` · ${unlinked} client name(s) in projects are not in this list yet` : ''}`}
      actions={canEdit ? <><button className="btn-secondary" disabled={busy} onClick={collect} title="Read the client names of all projects, unify the spelling and add the new clients"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} />Collect from projects</button><button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add client</button></> : undefined} />
    <div className="card mb-3 flex flex-wrap items-center gap-2 p-3"><SearchBox value={q} onChange={setQ} placeholder="Search clients" />
      <select className="input w-52" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country"><option value="">All countries</option>{countries.map((c) => <option key={c}>{c}</option>)}</select></div>
    {!clients.length ? <Empty title="No clients yet" hint={canEdit ? 'Press "Collect from projects": the portal reads the client names written in the projects, unifies the spelling and creates a card for each client. Then add the logos.' : 'An administrator has to collect the clients from the projects first.'} />
      : !shown.length ? <Empty title="No client matches" hint="Change the search or the country." />
      : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{shown.map((c) => { const n = projectsOf.get(c.key)?.length ?? 0; return (
        <button key={c.id} onClick={() => setOpenId(c.id)} className="card flex flex-col items-center gap-2 p-3 text-center transition hover:border-brand-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`${c.name}, ${n} projects`}>
          <Logo c={c} /><div className="w-full"><p className="break-words font-semibold leading-snug text-brand-900">{c.name}</p><p className="text-sm text-slate-500">{c.country || '—'}</p><p className="mt-1 text-xs text-slate-400">{n} project{n === 1 ? '' : 's'}</p></div></button>); })}</div>}
    {adding && <AddModal onClose={() => setAdding(false)} onDone={async (id) => { setAdding(false); await refresh(); setOpenId(id); }} />}
    {cur && <ClientModal key={cur.id} c={cur} all={clients} projects={projectsOf.get(cur.key) ?? []} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={refresh} />}
  </>);
}

function AddModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast(); const [name, setName] = useState(''); const [country, setCountry] = useState(''); const [busy, setBusy] = useState(false);
  return <Modal open onClose={onClose} title="Add client" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!name.trim() || busy} onClick={async () => { setBusy(true); try { const r = await api<{ id: string }>('/api/clients', { method: 'POST', body: { name, country: country || null } }); onDone(r.id); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } }}>Add</button></>}>
    <div className="space-y-3"><Field label="Client name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Country"><input className="input" list="client-countries" value={country} onChange={(e) => setCountry(e.target.value)} /><datalist id="client-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist></Field></div></Modal>;
}

function ClientModal({ c, all, projects, canEdit, onClose, onChanged }: { c: ClientRow; all: ClientRow[]; projects: any[]; canEdit: boolean; onClose: () => void; onChanged: () => Promise<any> | void }) {
  const toast = useToast(); const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(c.name); const [country, setCountry] = useState(c.country ?? ''); const [busy, setBusy] = useState(false); const [del, setDel] = useState(false); const [merge, setMerge] = useState('');
  const run = async (fn: () => Promise<unknown>, ok?: string, close = false) => { setBusy(true); try { await fn(); await onChanged(); if (ok) toast(ok); if (close) onClose(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const dirty = name.trim() !== c.name || (country.trim() || '') !== (c.country ?? '');
  return (<Modal open onClose={onClose} wide title={c.name} footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <div><Logo c={c} size="h-40" />
        {canEdit && <div className="mt-2 flex flex-wrap gap-2"><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => { const b = await logoBlob(f); await api(`/api/clients/${c.id}/logo`, { method: 'POST', raw: b, headers: { 'Content-Type': 'image/png', 'x-filename': encodeURIComponent(f.name) } }); }, 'Logo saved'); }} />
          <button className="btn-secondary btn-sm" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={14} />{c.logo_id ? 'Change logo' : 'Add logo'}</button>
          {c.logo_id && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api(`/api/clients/${c.id}/logo`, { method: 'DELETE' }), 'Logo removed')}><Trash2 size={14} />Remove</button>}</div>}</div>
      <div className="space-y-3">
        <Field label="Client name"><input className="input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Country"><input className="input" list="client-countries2" value={country} disabled={!canEdit} onChange={(e) => setCountry(e.target.value)} /><datalist id="client-countries2">{COUNTRIES.map((x) => <option key={x} value={x} />)}</datalist></Field>
        {canEdit && <div className="flex flex-wrap gap-2"><button className="btn-primary btn-sm" disabled={!dirty || !name.trim() || busy} onClick={() => run(() => api(`/api/clients/${c.id}`, { method: 'PUT', body: { name, country: country.trim() || null } }), 'Saved')}>Save</button>
          {dirty && <span className="self-center text-xs text-slate-500">Renaming also renames the client in its projects.</span>}</div>}
        <div><p className="label">Projects ({projects.length})</p>{projects.length ? <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">{projects.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5"><Link className="min-w-0 truncate text-brand-700 hover:underline" href={`/projects?id=${p.id}`}>{p.project_no ? `${p.project_no} · ` : ''}{p.name}</Link><StatusBadge status={p.status} /></li>)}</ul> : <p className="text-sm text-slate-500">No project uses this client name.</p>}</div>
        {canEdit && <div className="border-t border-slate-200 pt-3"><p className="label">Same client written differently?</p><div className="flex flex-wrap gap-2"><select className="input w-64" value={merge} onChange={(e) => setMerge(e.target.value)} aria-label="Merge into"><option value="">Merge into…</option>{all.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <button className="btn-secondary btn-sm" disabled={!merge || busy} onClick={() => run(() => api(`/api/clients/${c.id}`, { method: 'PUT', body: { merge_into: merge } }), 'Merged', true)}>Merge</button>
          <button className="btn-danger btn-sm ml-auto" disabled={busy} onClick={() => setDel(true)}><Trash2 size={14} />Delete client</button></div></div>}
      </div></div>
    <Confirm open={del} title="Delete client" message={`Delete "${c.name}" and its logo? The projects keep their client name.`} confirmLabel="Delete" danger onClose={() => setDel(false)} onConfirm={() => run(() => api(`/api/clients/${c.id}`, { method: 'DELETE' }), 'Client deleted', true)} />
  </Modal>);
}
export default function ClientsPage() { return <Suspense fallback={<p className="p-6 text-slate-500">Loading…</p>}><Inner /></Suspense>; }
