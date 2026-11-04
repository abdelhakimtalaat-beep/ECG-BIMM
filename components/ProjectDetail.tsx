'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Crop, FileDown, ImagePlus, Trash2 } from 'lucide-react';
import { api, fmtDate, fmtDateTime, fmtNum, loadOriginalPhoto, loadPhotoForEdit, resizeImage, saveOriginalPhoto } from '@/lib/client';
import { canEditProject } from '@/lib/can';
import { upcomingReels } from '@/lib/metrics';
import { COUNTRIES } from '@/lib/countries';
import { ImageCropper } from './ImageCropper';
import { optionsOf, projectWorkload } from '@/lib/workload';
import { STATUSES, type Project, type Status } from '@/lib/types';
import { useApp } from './store';
import { AssignModal } from './AssignModal';
import { ProjectContents } from './ProjectContents';
import { Badge, Confirm, Drawer, Field, StatusBadge, useToast } from './ui';

/** Photo ratio of the cards in the All Projects area (width : height). Choosing it in the photo editor makes the card show the whole saved photo. */
export const PROJECT_CARD_RATIO = 2;
export function ProjectPhoto({ project, className = '', fit = false }: { project: Project; className?: string; fit?: boolean }) {
  if (project.photo_id) return <img src={`/api/files/${project.photo_id}`} alt={`Photograph of ${project.name}`} className={`${fit ? 'bg-slate-100 object-contain' : 'object-cover'} ${className}`} loading="lazy" />;
  return <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-brand-300 ${fit ? 'h-48' : ''} ${className}`} role="img" aria-label="No project photo uploaded"><Building2 size={36} /><span className="mt-1 text-[11px] text-slate-400">No photo uploaded</span></div>;
}

export function ProjectDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { me, data, emp, refresh, today } = useApp(); const toast = useToast();
  const p = id ? data.projects.find((x) => x.id === id) : null;
  const [extra, setExtra] = useState<{ history: any[]; notes: any[] } | null>(null);
  const [edit, setEdit] = useState<Record<string, any> | null>(null);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cropFile, setCropFile] = useState<File | null>(null); const [cropOrig, setCropOrig] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false); const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => { if (id) { try { setExtra(await api(`/api/projects/${id}`)); } catch {} } }, [id]);
  useEffect(() => { setExtra(null); setEdit(null); setFe({}); setSaveState('idle'); if (id) load(); }, [id, load]);
  // Autosave: every change is written about 0.7 s after the last keystroke (no Save button)
  const savingRef = useRef(false); const saveRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { if (!edit) return; const t = setTimeout(() => { void saveRef.current(); }, 700); return () => clearTimeout(t); }, [edit]);

  const asg = useMemo(() => data.assignments.filter((a) => a.project_id === id), [data.assignments, id]);
  const mgrs = asg.filter((a) => a.role === 'manager'), coords = asg.filter((a) => a.role === 'coordinator'), members = asg.filter((a) => a.role === 'member');
  const scope = canEditProject(me, mgrs.map((a) => a.employee_id), coords.map((a) => a.employee_id));
  const can = (f: string) => ({ full: ['project_no', 'typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items', 'scope_site', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'country', 'city', 'revit_version', 'forma_url', 'forma_email', 'built_up_area', 'plot_area', 'status', 'notes'], manager: ['typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items', 'scope_site', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'country', 'city', 'revit_version', 'forma_url', 'forma_email', 'built_up_area', 'plot_area', 'status', 'notes'], coordinator: ['notes'], none: [] } as any)[scope].includes(f);
  // Forma URL / e-mail show as clickable links until the user presses Edit (or starts typing in them)
  const linkMode = (f: 'forma_url' | 'forma_email') => !!(p as any)?.[f] && !fe[f] && !(edit && f in edit);
  const team = new Set(asg.map((a) => a.employee_id));
  const isProjectMgr = me.role === 'bim_manager' && !!me.employee_id && mgrs.some((a) => a.employee_id === me.employee_id);
  const canCoord = me.role === 'admin' || isProjectMgr;
  const [assigning, setAssigning] = useState(false); const [fe, setFe] = useState<Record<string, boolean>>({});
  const related = useMemo(() => upcomingReels(data.reels, today).filter((r) => r.employee_id && team.has(r.employee_id)), [data.reels, today, team]);

  if (!p) return <Drawer open={false} onClose={onClose} title="" children={null} />;
  const names = (l: typeof asg) => (l.length ? l.map((a) => emp.get(a.employee_id)?.name).join(', ') : '—');
  const save = async () => {
    const snap = edit; if (!snap || savingRef.current) return;
    const body: any = {};
    for (const k of Object.keys(snap)) {
      if (k === 'reason') continue; let v: any = snap[k] === '' ? null : snap[k];
      if ((k === 'built_up_area' || k === 'plot_area') && v != null) { v = Number(v); if (!Number.isFinite(v)) continue; }
      if (k === 'forma_url' && v && !/^https?:\/\/\S+$/i.test(v)) continue;                 // half-typed link: wait until it is complete
      if (k === 'forma_email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) continue;     // half-typed e-mail: wait
      if (k === 'name' && !v) continue;                                                     // the name cannot be empty
      body[k] = v;
    }
    if (!Object.keys(body).length) return;
    savingRef.current = true; setSaveState('saving');
    try {
      await api(`/api/projects/${p.id}`, { method: 'PATCH', body });
      setEdit((cur) => { if (!cur) return null; const rest: Record<string, any> = { ...cur }; for (const k of Object.keys(body)) if (cur[k] === snap[k]) delete rest[k]; return Object.keys(rest).length ? rest : null; }); // keep anything typed while saving
      setSaveState('saved'); await refresh(); load();
    } catch (e: any) { toast(e.message, 'err'); setSaveState('error'); } finally { savingRef.current = false; }
  };
  saveRef.current = save;
  const close = async () => { for (let n = 0; n < 30 && savingRef.current; n++) await new Promise((r) => setTimeout(r, 100)); if (edit) await save(); onClose(); }; // never lose a pending change
  const upload = async (f: Blob, name: string) => {
    try { await api(`/api/projects/${p.id}/photo`, { raw: f, headers: { 'Content-Type': 'image/jpeg', 'x-filename': encodeURIComponent(name) } }); toast('Photo updated'); refresh(); }
    catch (e: any) { toast(e.message, 'err'); }
  };
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(16); doc.setTextColor(11, 37, 69); doc.text(p.name, 40, 50, { maxWidth: 515 });
    doc.setFontSize(9); doc.setTextColor(100); doc.text(`ECG BIM Department Management Portal · exported ${fmtDateTime(new Date())}`, 40, 68);
    let y = 84;
    if (p.photo_id) { try { const b = await (await fetch(`/api/files/${p.photo_id}`)).blob(); const url: string = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); }); doc.addImage(url, 'JPEG', 40, y, 160, 110); y += 122; } catch {} }
    autoTable(doc, { startY: y, head: [['Field', 'Value']], theme: 'grid', headStyles: { fillColor: [15, 85, 168] }, body: [
      ['Project number', p.project_no ?? '—'], ['Status', p.status], ['Built-up area', p.built_up_area ? fmtNum(p.built_up_area) : (p.area_note ?? '—')], ['Revit version', p.revit_version ?? '—'], ['Plot Area', p.plot_area ? fmtNum(p.plot_area) : '—'], ['Deltek number', p.deltek_number ?? '—'], ['Client', p.client ?? '—'], ['Project Manager', p.project_manager ?? '—'], ['Technical Manager', p.technical_manager ?? '—'], ['CDE', p.cde ?? '—'], ['Type', p.type ?? '—'],
      ['BIM Manager', names(mgrs)], ['BIM Coordinator', names(coords)], ['Other team members', names(members)], ['Original workbook status', `${p.status_raw ?? '—'}${p.activity_raw ? ` / ${p.activity_raw}` : ''}`], ['Last updated', fmtDate(p.updated_at)], ['Notes', p.notes ?? '—']] });
    if (extra?.history.length) autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 16, head: [['Date', 'From', 'To', 'By', 'Reason']], headStyles: { fillColor: [15, 85, 168] }, body: extra.history.map((h) => [fmtDate(h.changed_at), h.old_status ?? '—', h.new_status, h.changed_by ?? '', h.reason ?? '']) });
    if (extra?.notes.length) autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 16, head: [['Management comments', 'By', 'Date']], headStyles: { fillColor: [15, 85, 168] }, body: extra.notes.map((n) => [n.body, n.author ?? '', fmtDate(n.created_at)]) });
    doc.save(`project-${p.project_no ?? p.id.slice(0, 8)}.pdf`);
  };
  const E = edit ?? {};
  const numInp = (k: string) => <input inputMode="decimal" className="input" disabled={!can(k)} value={(() => { const v = k in E ? E[k] : (p as any)[k]; if (v == null || v === '') return ''; const [i, d] = String(v).split('.'); const n = i.replace(/[^\d]/g, ''); return (n ? Number(n).toLocaleString('en-US') : '') + (d !== undefined ? '.' + d : ''); })()} onChange={(e) => setEdit({ ...E, [k]: e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '') })} />;
  const inp = (k: string, type = 'text') => <input type={type} className="input" disabled={!can(k)} value={(k in E ? E[k] : (p as any)[k]) ?? ''} onChange={(e) => setEdit({ ...E, [k]: e.target.value })} />;

  return (
    <><Drawer open onClose={close} title={`${p.project_no ? p.project_no + ' · ' : ''}${p.name}`} width="max-w-2xl">
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-xl border border-slate-200"><ProjectPhoto project={p} className="max-h-96 w-full" fit />
          {(scope !== 'none') && <div className="absolute bottom-2 right-2 flex gap-1"><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setCropOrig(true); setCropFile(f); } }} />
            <button className="btn-secondary btn-sm" onClick={() => file.current?.click()}><ImagePlus size={14} />{p.photo_id ? 'Replace' : 'Upload'} photo</button>
            {p.photo_id && <button className="btn-secondary btn-sm" onClick={async () => { try { const r = await loadPhotoForEdit('project', p.id, p.photo_id!); setCropOrig(!r.fromOriginal); setCropFile(r.file); } catch (e: any) { toast(e.message, 'err'); } }}><Crop size={14} />Edit / crop</button>}
            {p.photo_id && <button className="btn-secondary btn-sm" title="Put back the photo exactly as it was uploaded" onClick={async () => { try { const o = await loadOriginalPhoto('project', p.id); if (!o) { toast('No original is stored for this photo (it was uploaded before originals were kept). Upload it again to enable Reset.', 'err'); return; } if (!window.confirm('Reset the photo to the original upload (removes the crop)?')) return; await upload(await resizeImage(o, 1600), 'original.jpg'); } catch (e: any) { toast(e.message, 'err'); } }}>Reset to original</button>}
            {p.photo_id && <button className="btn-secondary btn-sm" aria-label="Remove photo" onClick={async () => { await api(`/api/projects/${p.id}/photo`, { method: 'DELETE' }); refresh(); }}><Trash2 size={14} /></button>}</div>}</div>

        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} />{p.status_source === 'manual' && <Badge tone="blue" title="Set by a user rather than derived from the workbook status mapping">manual</Badge>}
          {!p.project_no && <Badge tone="amber">no project number</Badge>}{!p.built_up_area && <Badge tone="amber" title={p.area_note ?? ''}>no valid area</Badge>}{!mgrs.length && <Badge tone="red">no BIM Manager</Badge>}{!coords.length && p.status !== 'Closed' && <Badge tone="amber">no Coordinator</Badge>}
          <button className="btn-secondary btn-sm ml-auto" onClick={exportPdf}><FileDown size={14} />PDF</button></div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project number">{inp('project_no')}</Field><Field label="Project name">{inp('name')}</Field>
          <Field label="Deltek number">{inp('deltek_number')}</Field><Field label="Client">{inp('client')}</Field>
          <Field label="Country"><input list="ecg-countries" className="input" disabled={!can('country')} placeholder="e.g. Saudi Arabia" value={('country' in E ? E.country : p.country) ?? ''} onChange={(e) => setEdit({ ...E, country: e.target.value })} /><datalist id="ecg-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="City">{inp('city')}</Field>
          <Field label="Project Manager">{inp('project_manager')}</Field><Field label="Technical Manager">{inp('technical_manager')}</Field>
          <Field label="CDE">{inp('cde')}</Field><Field label="Type">{inp('type')}</Field>
          <Field label="Built-up area">{numInp('built_up_area')}</Field>
          <Field label="Plot Area">{numInp('plot_area')}</Field>
          <Field label="Revit version"><select className="input" disabled={!can('revit_version')} value={('revit_version' in E ? E.revit_version : p.revit_version) ?? ''} onChange={(e) => setEdit({ ...E, revit_version: e.target.value })}><option value="">— not set —</option>{['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'].map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Autodesk Forma URL">
            {linkMode('forma_url') ? <div className="flex items-center gap-2"><a className="input flex-1 truncate text-brand-700 underline" href={p.forma_url!} target="_blank" rel="noopener noreferrer" title="Open in Autodesk Forma">{p.forma_url}</a>{can('forma_url') && <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setFe((x) => ({ ...x, forma_url: true }))}>Edit</button>}</div>
              : <input type="url" autoFocus={!!fe.forma_url} onBlur={() => setFe((x) => ({ ...x, forma_url: false }))} className="input" disabled={!can('forma_url')} placeholder="https://…" value={('forma_url' in E ? E.forma_url : p.forma_url) ?? ''} onChange={(e) => setEdit({ ...E, forma_url: e.target.value })} />}</Field>
          <Field label="Autodesk Forma e-mail address">
            {linkMode('forma_email') ? <div className="flex items-center gap-2"><a className="input flex-1 truncate text-brand-700 underline" href={`mailto:?cc=${encodeURIComponent(p.forma_email!)}`} title="New e-mail with this address in CC">{p.forma_email}</a>{can('forma_email') && <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setFe((x) => ({ ...x, forma_email: true }))}>Edit</button>}</div>
              : <input type="email" autoFocus={!!fe.forma_email} onBlur={() => setFe((x) => ({ ...x, forma_email: false }))} className="input" disabled={!can('forma_email')} placeholder="name@company.com" value={('forma_email' in E ? E.forma_email : p.forma_email) ?? ''} onChange={(e) => setEdit({ ...E, forma_email: e.target.value })} />}</Field>
          <div className="col-span-2 mt-1 border-t border-slate-200 pt-3"><p className="text-sm font-semibold text-brand-900">Workload Factors</p>{!can('typicality') && <p className="text-xs text-slate-500">View only — you can edit the factors of projects you are assigned to.</p>}</div>
          {([['typicality', 'Typicality'], ['function_type', 'Function'], ['coordination_type', 'Coordination'], ['bim_standards', 'BIM Standards']] as const).map(([k, label]) => { const fac = data.settings.factors[k]; const opts = Object.keys(fac); return [k, label, opts, fac] as const; }).map(([k, label, opts, fac]) => (
            <Field key={k} label={label}><select className="input" disabled={!can(k)} value={(k in E ? E[k] : (p as any)[k]) ?? ''} onChange={(e) => setEdit({ ...E, [k]: e.target.value })}>
              <option value="">— not set —</option>{opts.map((o) => <option key={o} value={o}>{o} ({(fac as any)[o]})</option>)}</select></Field>))}
          {([['scope_items', 'Buildings scope (tick one or more)'], ['scope_site', 'Site work scope (tick one or more)']] as const).map(([k, label]) => (
            <div key={k} className="col-span-2"><p className="label">{label}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">{Object.keys(data.settings.factors[k]).map((o) => { const cur: string[] = (k in E ? E[k] : (p as any)[k]) ?? []; return (
                <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" disabled={!can(k)} checked={cur.includes(o)} onChange={(e) => setEdit({ ...E, [k]: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o) })} />{o} <span className="text-xs text-slate-500">({data.settings.factors[k][o]})</span></label>); })}</div></div>))}
          <div className="col-span-2 rounded-lg bg-brand-50 p-3 text-sm"><span className="text-slate-600">Workload = (Built-up area × Typicality × Function × Coordination × BIM Standards × Buildings scope) + (Plot Area × Function × Coordination × BIM Standards × Site work scope) = </span>
            <b className="text-brand-900">{(() => { const w = projectWorkload({ built_up_area: 'built_up_area' in E ? Number(E.built_up_area) : p.built_up_area, typicality: 'typicality' in E ? E.typicality : p.typicality, function_type: 'function_type' in E ? E.function_type : p.function_type, coordination_type: 'coordination_type' in E ? E.coordination_type : p.coordination_type, bim_standards: 'bim_standards' in E ? E.bim_standards : p.bim_standards, scope_items: 'scope_items' in E ? E.scope_items : p.scope_items, plot_area: 'plot_area' in E ? Number(E.plot_area) : p.plot_area, scope_site: 'scope_site' in E ? E.scope_site : p.scope_site }, data.settings.factors); return w == null ? 'not calculated (Function, Coordination and BIM Standards are required, plus either Built-up area + Typicality + a Buildings scope, or Plot Area + a Site work scope)' : fmtNum(w); })()}</b></div>
          <Field label="Status">
            <select className="input" disabled={!can('status')} value={'status' in E ? E.status : p.status} onChange={(e) => setEdit({ ...E, status: e.target.value as Status })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <div className="col-span-2"><Field label="Notes"><textarea rows={2} className="input" disabled={!can('notes')} value={('notes' in E ? E.notes : p.notes) ?? ''} onChange={(e) => setEdit({ ...E, notes: e.target.value })} /></Field></div>
        </div>
        {scope !== 'none' && <p className={`text-xs ${saveState === 'error' ? 'text-red-600' : 'text-slate-500'}`} role="status" aria-live="polite">{saveState === 'saving' || (edit && saveState !== 'error') ? 'Saving…' : saveState === 'error' ? <>Could not save. <button className="underline" onClick={() => void save()}>Try again</button></> : saveState === 'saved' ? '✓ All changes saved' : 'Changes are saved automatically.'}</p>}
        {scope === 'none' && <p className="text-xs text-slate-500">You have view-only access to this project.</p>}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {([['manager', 'BIM Manager', mgrs], ['coordinator', 'BIM Coordinator', coords]] as const).map(([role, label, cur]) => (
            <div key={role}><p className="label">{label}</p>
              {(role === 'manager' ? me.role === 'admin' : canCoord) && cur.length <= 1
                ? <select className="input" aria-label={label} value={cur[0]?.employee_id ?? ''} onChange={async (ev) => { try { const r: any = await api(`/api/projects/${p.id}/team`, { method: 'PUT', body: { role, employee_id: ev.target.value || null } }); toast(r?.mail === 'sent' ? `${label} updated — notification e-mail sent` : `${label} updated`); refresh(); load(); } catch (e: any) { toast(e.message, 'err'); } }}>
                    <option value="">— none —</option>
                    {data.employees.filter((e) => (e.active || e.id === cur[0]?.employee_id) && (role === 'coordinator' || ['bim_manager', 'department_manager'].includes(e.job_category))).sort((x, y) => x.name.localeCompare(y.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                : <>{names(cur)}{(role === 'manager' ? me.role === 'admin' : canCoord) && <p className="text-xs text-slate-500">Several assigned — use “Manage coordinators”.</p>}</>}
              {role === 'coordinator' && canCoord && <button className="btn-secondary btn-sm mt-2" onClick={() => setAssigning(true)}>Manage coordinators</button>}
            </div>))}
          {members.length > 0 && <div className="col-span-2"><p className="label">Other team members</p>{names(members)}</div>}</div>

        <ProjectContents projectId={p.id} canEdit={scope !== 'none'} />

        <div><p className="label">Status history</p>{!extra ? <p className="text-sm text-slate-500">Loading…</p> : extra.history.length ? <ul className="space-y-1 text-sm">{extra.history.map((h, i) => <li key={i} className="flex flex-wrap gap-x-2 border-l-2 border-brand-200 pl-3"><span className="text-slate-500">{fmtDate(h.changed_at)}</span><span>{h.old_status ? `${h.old_status} → ` : ''}<b>{h.new_status}</b></span><span className="text-xs text-slate-500">{h.changed_by}{h.reason ? ` · ${h.reason}` : ''}</span></li>)}</ul> : <p className="text-sm text-slate-500">No history.</p>}</div>

        <div><p className="label">Management comments</p>
          {extra?.notes.map((n) => <div key={n.id} className="mb-2 rounded-lg bg-slate-50 p-3 text-sm"><p>{n.body}</p><p className="mt-1 text-xs text-slate-500">{n.author} · {fmtDate(n.created_at)}</p></div>)}
          {scope !== 'none' && <div className="flex gap-2"><input className="input" placeholder="Add a comment…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" disabled={!note.trim()} onClick={async () => { try { await api(`/api/projects/${p.id}/notes`, { body: { body: note } }); setNote(''); load(); } catch (e: any) { toast(e.message, 'err'); } }}>Add</button></div>}</div>

        <div><p className="label">Related BIM Reels (upcoming sessions by this project's team)</p>{related.length ? <ul className="text-sm">{related.map((r) => <li key={r.id}>{fmtDate(r.session_date)} — {r.presenter_name}{r.topic ? `: ${r.topic}` : ''}</li>)}</ul> : <p className="text-sm text-slate-500">None scheduled.</p>}</div>

        {me.role === 'admin' && <div className="border-t border-slate-200 pt-4"><button className="btn-danger btn-sm" onClick={() => setConfirmDel(true)}><Trash2 size={14} />Delete project</button></div>}
      </div>
      <Confirm open={confirmDel} danger title="Delete project" confirmLabel="Delete permanently" onClose={() => setConfirmDel(false)} message={<>Permanently delete <b>{p.name}</b> with its assignments, history and comments? To keep the record, set its status to Closed instead.</>}
        onConfirm={async () => { try { await api(`/api/projects/${p.id}`, { method: 'DELETE' }); toast('Deleted'); setConfirmDel(false); onClose(); refresh(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </Drawer>
      {assigning && <AssignModal projectId={p.id} onClose={() => { setAssigning(false); load(); }} />}
    {cropFile && <ImageCropper file={cropFile} title="Crop project photo" outWidth={1200} aspects={[{ label: 'Projects card (2:1)', value: PROJECT_CARD_RATIO }, { label: 'Original ratio', value: 0 }, { label: '16:9', value: 16 / 9 }, { label: '4:3', value: 4 / 3 }, { label: 'Square', value: 1 }]} onCancel={() => setCropFile(null)} onDone={async (b, n) => { const f = cropFile; setCropFile(null); await upload(b, n); if (cropOrig && f) await saveOriginalPhoto('project', p.id, f).catch(() => {}); }} />}
    </>
  );
}
