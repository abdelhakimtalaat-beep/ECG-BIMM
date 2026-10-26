'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, FileDown, ImagePlus, Trash2 } from 'lucide-react';
import { api, fmtDate, fmtDateTime, fmtNum } from '@/lib/client';
import { canEditProject } from '@/lib/can';
import { upcomingReels } from '@/lib/metrics';
import { COORDINATION, COORDINATION_OPTIONS, FUNCTION_OPTIONS, FUNCTION_TYPES, TYPICALITY, TYPICALITY_OPTIONS, projectWorkload } from '@/lib/workload';
import { STATUSES, type Project, type Status } from '@/lib/types';
import { useApp } from './store';
import { Badge, Confirm, Drawer, Field, StatusBadge, useToast } from './ui';

export function ProjectPhoto({ project, className = '' }: { project: Project; className?: string }) {
  if (project.photo_id) return <img src={`/api/files/${project.photo_id}`} alt={`Photograph of ${project.name}`} className={`object-cover ${className}`} loading="lazy" />;
  return <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-brand-300 ${className}`} role="img" aria-label="No project photo uploaded"><Building2 size={36} /><span className="mt-1 text-[11px] text-slate-400">No photo uploaded</span></div>;
}

export function ProjectDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { me, data, emp, refresh, today } = useApp(); const toast = useToast();
  const p = id ? data.projects.find((x) => x.id === id) : null;
  const [extra, setExtra] = useState<{ history: any[]; notes: any[] } | null>(null);
  const [edit, setEdit] = useState<Record<string, any> | null>(null);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false); const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => { if (id) { try { setExtra(await api(`/api/projects/${id}`)); } catch {} } }, [id]);
  useEffect(() => { setExtra(null); setEdit(null); if (id) load(); }, [id, load]);

  const asg = useMemo(() => data.assignments.filter((a) => a.project_id === id), [data.assignments, id]);
  const mgrs = asg.filter((a) => a.role === 'manager'), coords = asg.filter((a) => a.role === 'coordinator'), members = asg.filter((a) => a.role === 'member');
  const scope = canEditProject(me, mgrs.map((a) => a.employee_id), coords.map((a) => a.employee_id));
  const can = (f: string) => ({ full: ['project_no', 'typicality', 'function_type', 'coordination_type', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'built_up_area', 'status', 'notes'], manager: ['name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'built_up_area', 'status', 'notes'], coordinator: ['notes'], none: [] } as any)[scope].includes(f);
  const team = new Set(asg.map((a) => a.employee_id));
  const related = useMemo(() => upcomingReels(data.reels, today).filter((r) => r.employee_id && team.has(r.employee_id)), [data.reels, today, team]);

  if (!p) return <Drawer open={false} onClose={onClose} title="" children={null} />;
  const names = (l: typeof asg) => (l.length ? l.map((a) => emp.get(a.employee_id)?.name).join(', ') : '—');
  const save = async () => {
    if (!edit) return; setBusy(true);
    try {
      const body: any = {}; for (const k of Object.keys(edit)) body[k] = edit[k] === '' ? null : edit[k];
      if ('built_up_area' in body && body.built_up_area != null) body.built_up_area = Number(body.built_up_area);
      await api(`/api/projects/${p.id}`, { method: 'PATCH', body }); toast('Saved'); setEdit(null); await refresh(); load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const upload = async (f: File) => {
    try { await api(`/api/projects/${p.id}/photo`, { raw: f, headers: { 'Content-Type': f.type, 'x-filename': encodeURIComponent(f.name) } }); toast('Photo updated'); refresh(); }
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
      ['Project number', p.project_no ?? '—'], ['Status', p.status], ['Built-up area', p.built_up_area ? fmtNum(p.built_up_area) : (p.area_note ?? '—')], ['Deltek number', p.deltek_number ?? '—'], ['Client', p.client ?? '—'], ['Project Manager', p.project_manager ?? '—'], ['Technical Manager', p.technical_manager ?? '—'], ['CDE', p.cde ?? '—'], ['Type', p.type ?? '—'],
      ['BIM Manager', names(mgrs)], ['BIM Coordinator', names(coords)], ['Other team members', names(members)], ['Original workbook status', `${p.status_raw ?? '—'}${p.activity_raw ? ` / ${p.activity_raw}` : ''}`], ['Last updated', fmtDate(p.updated_at)], ['Notes', p.notes ?? '—']] });
    if (extra?.history.length) autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 16, head: [['Date', 'From', 'To', 'By', 'Reason']], headStyles: { fillColor: [15, 85, 168] }, body: extra.history.map((h) => [fmtDate(h.changed_at), h.old_status ?? '—', h.new_status, h.changed_by ?? '', h.reason ?? '']) });
    if (extra?.notes.length) autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 16, head: [['Management comments', 'By', 'Date']], headStyles: { fillColor: [15, 85, 168] }, body: extra.notes.map((n) => [n.body, n.author ?? '', fmtDate(n.created_at)]) });
    doc.save(`project-${p.project_no ?? p.id.slice(0, 8)}.pdf`);
  };
  const E = edit ?? {};
  const inp = (k: string, type = 'text') => <input type={type} className="input" disabled={!can(k)} value={(k in E ? E[k] : (p as any)[k]) ?? ''} onChange={(e) => setEdit({ ...E, [k]: e.target.value })} />;

  return (
    <Drawer open onClose={onClose} title={`${p.project_no ? p.project_no + ' · ' : ''}${p.name}`} width="max-w-2xl">
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-xl border border-slate-200"><ProjectPhoto project={p} className="h-48 w-full" />
          {(scope !== 'none') && <div className="absolute bottom-2 right-2 flex gap-1"><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn-secondary btn-sm" onClick={() => file.current?.click()}><ImagePlus size={14} />{p.photo_id ? 'Replace' : 'Upload'} photo</button>
            {p.photo_id && <button className="btn-secondary btn-sm" aria-label="Remove photo" onClick={async () => { await api(`/api/projects/${p.id}/photo`, { method: 'DELETE' }); refresh(); }}><Trash2 size={14} /></button>}</div>}</div>

        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} />{p.status_source === 'manual' && <Badge tone="blue" title="Set by a user rather than derived from the workbook status mapping">manual</Badge>}
          {!p.project_no && <Badge tone="amber">no project number</Badge>}{!p.built_up_area && <Badge tone="amber" title={p.area_note ?? ''}>no valid area</Badge>}{!mgrs.length && <Badge tone="red">no BIM Manager</Badge>}{!coords.length && p.status !== 'Closed' && <Badge tone="amber">no Coordinator</Badge>}
          <button className="btn-secondary btn-sm ml-auto" onClick={exportPdf}><FileDown size={14} />PDF</button></div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project number">{inp('project_no')}</Field><Field label="Project name">{inp('name')}</Field>
          <Field label="Deltek number">{inp('deltek_number')}</Field><Field label="Client">{inp('client')}</Field>
          <Field label="Project Manager">{inp('project_manager')}</Field><Field label="Technical Manager">{inp('technical_manager')}</Field>
          <Field label="CDE">{inp('cde')}</Field><Field label="Type">{inp('type')}</Field>
          <Field label="Built-up area" hint={p.area_note ? `Source: ${p.area_raw} — ${p.area_note}` : undefined}>{inp('built_up_area', 'number')}</Field>
          <div className="col-span-2 mt-1 border-t border-slate-200 pt-3"><p className="text-sm font-semibold text-brand-900">Workload Factors</p>{!can('typicality') && <p className="text-xs text-slate-500">Filled by the Administrator.</p>}</div>
          {([['typicality', 'Typicality', TYPICALITY_OPTIONS, TYPICALITY], ['function_type', 'Function', FUNCTION_OPTIONS, FUNCTION_TYPES], ['coordination_type', 'Coordination', COORDINATION_OPTIONS, COORDINATION]] as const).map(([k, label, opts, fac]) => (
            <Field key={k} label={label}><select className="input" disabled={!can(k)} value={(k in E ? E[k] : (p as any)[k]) ?? ''} onChange={(e) => setEdit({ ...E, [k]: e.target.value })}>
              <option value="">— not set —</option>{opts.map((o) => <option key={o} value={o}>{o} ({(fac as any)[o]})</option>)}</select></Field>))}
          <div className="col-span-2 rounded-lg bg-brand-50 p-3 text-sm"><span className="text-slate-600">Workload = Built-up area × Typicality × Function × Coordination = </span>
            <b className="text-brand-900">{(() => { const w = projectWorkload({ built_up_area: 'built_up_area' in E ? Number(E.built_up_area) : p.built_up_area, typicality: 'typicality' in E ? E.typicality : p.typicality, function_type: 'function_type' in E ? E.function_type : p.function_type, coordination_type: 'coordination_type' in E ? E.coordination_type : p.coordination_type }); return w == null ? 'not calculated (area and all three factors are required)' : fmtNum(w); })()}</b></div>
          <Field label="Status" hint={`Workbook: ${p.status_raw ?? '—'}${p.activity_raw ? ' / ' + p.activity_raw : ''}`}>
            <select className="input" disabled={!can('status')} value={'status' in E ? E.status : p.status} onChange={(e) => setEdit({ ...E, status: e.target.value as Status })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <div className="col-span-2"><Field label="Notes"><textarea rows={2} className="input" disabled={!can('notes')} value={('notes' in E ? E.notes : p.notes) ?? ''} onChange={(e) => setEdit({ ...E, notes: e.target.value })} /></Field></div>
          {edit && 'status' in edit && edit.status !== p.status && <div className="col-span-2"><Field label="Reason for status change (optional)"><input className="input" value={E.reason ?? ''} onChange={(e) => setEdit({ ...E, reason: e.target.value })} /></Field></div>}
        </div>
        {edit && <div className="flex gap-2"><button className="btn-primary" disabled={busy} onClick={save}>Save changes</button><button className="btn-secondary" onClick={() => setEdit(null)}>Discard</button></div>}
        {scope === 'none' && <p className="text-xs text-slate-500">You have view-only access to this project.</p>}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {([['manager', 'BIM Manager', mgrs], ['coordinator', 'BIM Coordinator', coords]] as const).map(([role, label, cur]) => (
            <div key={role}><p className="label">{label}</p>
              {me.role === 'admin' && cur.length <= 1
                ? <select className="input" aria-label={label} value={cur[0]?.employee_id ?? ''} onChange={async (ev) => { try { await api(`/api/projects/${p.id}/team`, { method: 'PUT', body: { role, employee_id: ev.target.value || null } }); toast(`${label} updated`); refresh(); load(); } catch (e: any) { toast(e.message, 'err'); } }}>
                    <option value="">— none —</option>
                    {data.employees.filter((e) => (e.active || e.id === cur[0]?.employee_id) && (role === 'coordinator' || ['bim_manager', 'department_manager'].includes(e.job_category))).sort((x, y) => x.name.localeCompare(y.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                : <>{names(cur)}{me.role === 'admin' && <p className="text-xs text-slate-500">Several assigned — manage in the Teams tab.</p>}</>}
            </div>))}
          {members.length > 0 && <div className="col-span-2"><p className="label">Other team members</p>{names(members)}</div>}</div>

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
  );
}
