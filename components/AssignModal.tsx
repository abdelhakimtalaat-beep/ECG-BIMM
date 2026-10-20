'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { canEditProject } from '@/lib/can';
import { useApp } from './store';
import { Badge, Confirm, Field, Modal, StatusBadge, useToast } from './ui';

/** View / add / replace / remove the people on one project. Server enforces the same rules (lib/perm.ts, api/assignments). */
export function AssignModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { me, data, emp, refresh } = useApp(); const toast = useToast();
  const p = data.projects.find((x) => x.id === projectId)!;
  const asg = data.assignments.filter((a) => a.project_id === projectId);
  const scope = canEditProject(me, asg.filter((a) => a.role === 'manager').map((a) => a.employee_id), asg.filter((a) => a.role !== 'manager').map((a) => a.employee_id));
  const editable = (role: string) => (role === 'manager' ? scope === 'full' : scope === 'full' || scope === 'manager');
  const [add, setAdd] = useState({ role: 'coordinator', employee_id: '', pkg: '' });
  const [conf, setConf] = useState<null | { kind: 'remove'; id: string; label: string } | { kind: 'replace'; role: 'manager' | 'coordinator'; from: string; to: string }>(null);
  const eligible = (role: string) => data.employees.filter((e) => e.active && (role === 'manager' ? ['bim_manager', 'department_manager'].includes(e.job_category) : true));
  const run = async (fn: () => Promise<any>, ok: string) => { try { await fn(); toast(ok); setConf(null); await refresh(); } catch (e: any) { toast(e.message, 'err'); setConf(null); } };

  return (
    <Modal open onClose={onClose} wide title={`Assignments — ${p.project_no ? p.project_no + ' · ' : ''}${p.name}`} footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="mb-3 flex items-center gap-2"><StatusBadge status={p.status} />{scope === 'none' && <Badge>view only</Badge>}</div>
      {!asg.length && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-800">This project has no assignments.</p>}
      <ul className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {asg.map((a) => { const e = emp.get(a.employee_id); return (
          <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1"><b className="font-medium">{e?.name}</b> <span className="text-xs text-slate-500">{e?.employee_code ?? ''}</span><br /><Badge tone={a.role === 'manager' ? 'blue' : 'gray'}>{a.role}</Badge>{a.package && <span className="ml-1 text-xs text-slate-500">package: {a.package}</span>}</span>
            {editable(a.role) && a.role !== 'member' && <select className="input w-44" value="" onChange={(ev) => ev.target.value && setConf({ kind: 'replace', role: a.role as any, from: a.employee_id, to: ev.target.value })} aria-label={`Replace ${e?.name}`}><option value="">Replace with…</option>{eligible(a.role).filter((x) => x.id !== a.employee_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
            {editable(a.role) && <button className="btn-secondary btn-sm" onClick={() => setConf({ kind: 'remove', id: a.id, label: `${e?.name} (${a.role})` })}>Remove</button>}
          </li>); })}
      </ul>
      {(scope === 'full' || scope === 'manager') ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
          <Field label="Role"><select className="input" value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })}>{scope === 'full' && <option value="manager">Manager</option>}<option value="coordinator">Coordinator</option><option value="member">Member</option></select></Field>
          <Field label="Person"><select className="input" value={add.employee_id} onChange={(e) => setAdd({ ...add, employee_id: e.target.value })}><option value="">Select…</option>{eligible(add.role).map((x) => <option key={x.id} value={x.id}>{x.name} — {x.job_title}</option>)}</select></Field>
          <Field label="Package (optional)"><input className="input" value={add.pkg} onChange={(e) => setAdd({ ...add, pkg: e.target.value })} placeholder="e.g. MEP" /></Field>
          <button className="btn-primary" disabled={!add.employee_id} onClick={() => run(() => api('/api/assignments', { body: { project_id: projectId, employee_id: add.employee_id, role: add.role, package: add.pkg || null } }).then(() => setAdd({ ...add, employee_id: '', pkg: '' })), 'Assignment added')}>Add</button>
        </div>) : <p className="text-xs text-slate-500">Only the Department Manager or this project's BIM Manager can change assignments. Every change is recorded in the audit log with your name.</p>}
      <Confirm open={!!conf} onClose={() => setConf(null)} title={conf?.kind === 'remove' ? 'Remove assignment' : 'Reassign'} confirmLabel={conf?.kind === 'remove' ? 'Remove' : 'Reassign'} danger={conf?.kind === 'remove'}
        message={conf?.kind === 'remove' ? <>Remove <b>{conf.label}</b> from <b>{p.name}</b>?</> : conf ? <>Replace <b>{emp.get(conf.from)?.name}</b> with <b>{emp.get(conf.to)?.name}</b> as {conf.role} on <b>{p.name}</b>?</> : null}
        onConfirm={() => conf && (conf.kind === 'remove' ? run(() => api('/api/assignments', { method: 'DELETE', body: { id: conf.id } }), 'Removed') : run(() => api('/api/assignments/reassign', { body: { project_id: projectId, role: conf.role, from_employee_id: conf.from, to_employee_id: conf.to, confirm: true } }), 'Reassigned'))} />
    </Modal>
  );
}
