'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, StatusBadge, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { TASK_STATUSES, canEditTasks, canManageSubAreas, isOverdue, managedProjectIds, taskStats } from '@/lib/tasks';
import type { Task } from '@/lib/types';

const TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green'> = { 'Not Started': 'gray', 'In Progress': 'blue', 'On Hold': 'amber', Completed: 'green' };

export default function TasksPage() {
  const { me, data, emp, refresh, today } = useApp(); const toast = useToast();
  const areas = data.task_areas ?? [], tasks = data.tasks ?? [];
  const pById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);

  // one area per BIM Manager: employees tagged BIM Manager plus anybody who manages a project
  const managers = useMemo(() => {
    const ids = new Set(data.assignments.filter((a) => a.role === 'manager').map((a) => a.employee_id));
    data.employees.forEach((e) => { if (e.job_category === 'bim_manager') ids.add(e.id); });
    areas.forEach((a) => ids.add(a.manager_id));
    return [...ids].map((id) => emp.get(id)).filter((e): e is NonNullable<typeof e> => !!e && (e.active || areas.some((a) => a.manager_id === e.id))).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.assignments, data.employees, areas, emp]);

  const mine = me.employee_id && managers.some((m) => m.id === me.employee_id) ? me.employee_id : null;
  const [who, setWho] = useState<string>(mine ?? 'all');
  const [status, setStatus] = useState<string>('all');
  const [assignee, setAssignee] = useState<string>('all');
  const [open, setOpen] = useState<Set<string>>(new Set(mine ? [mine] : []));
  const [taskForm, setTaskForm] = useState<{ area_id: string; task?: Task } | null>(null);
  const [addArea, setAddArea] = useState<string | null>(null);
  const [delTask, setDelTask] = useState<Task | null>(null);
  const [delArea, setDelArea] = useState<string | null>(null);

  const shown = managers.filter((m) => who === 'all' || m.id === who);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const visible = (t: Task) => (status === 'all' || t.status === status) && (assignee === 'all' || (assignee === 'none' ? !t.assignee_id : t.assignee_id === assignee));
  const call = async (fn: () => Promise<any>, msg?: string) => { try { await fn(); if (msg) toast(msg); await refresh(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-4">
      <PageHeader title="BIM Manager Tasks" subtitle="Each BIM Manager has an area. He adds his projects; he and his BIM Coordinators add and track the tasks. Everyone else can view." />
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <Field label="BIM Manager"><select className="input w-52" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">All BIM Managers</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Status"><select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Assignee"><select className="input w-48" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="all">Everyone</option><option value="none">Unassigned</option>{data.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        {me.employee_id && <button className="btn-secondary" onClick={() => setAssignee(assignee === me.employee_id ? 'all' : me.employee_id!)}>{assignee === me.employee_id ? 'Show everyone' : 'My tasks'}</button>}
      </div>

      {!shown.length ? <Empty title="No BIM Managers found" /> : shown.map((m) => {
        const myAreas = areas.filter((a) => a.manager_id === m.id).sort((a, b) => (pById.get(a.project_id)?.project_no ?? '').localeCompare(pById.get(b.project_id)?.project_no ?? ''));
        const all = tasks.filter((t) => myAreas.some((a) => a.id === t.area_id));
        const st = taskStats(all, today);
        const editor = canEditTasks(me.role, me.employee_id, m.id, data.assignments);
        const manage = canManageSubAreas(me.role, me.employee_id, m.id);
        const isOpen = open.has(m.id) || who !== 'all';
        return (
          <section key={m.id} className="card overflow-hidden">
            <button className="flex w-full flex-wrap items-center gap-3 bg-brand-50 px-4 py-3 text-left" onClick={() => toggle(m.id)} aria-expanded={isOpen}>
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="text-base font-semibold text-brand-900">{m.name}</span>
              <span className="text-xs text-slate-500">{myAreas.length} project{myAreas.length === 1 ? '' : 's'}</span>
              <span className="ml-auto flex flex-wrap gap-2 text-xs"><Badge tone="blue">{st.open} open</Badge>{st.overdue > 0 && <Badge tone="red">{st.overdue} overdue</Badge>}<Badge tone="green">{st.done} done</Badge></span>
            </button>
            {isOpen && <div className="space-y-4 p-4">
              {manage && <div><button className="btn-secondary btn-sm" onClick={() => setAddArea(m.id)}><FolderPlus size={14} />Add project</button></div>}
              {!myAreas.length && <p className="text-sm text-slate-500">No projects yet.{manage ? ' Add one of your projects to start tracking tasks.' : ''}</p>}
              {myAreas.map((a) => {
                const p = pById.get(a.project_id); const rows = tasks.filter((t) => t.area_id === a.id && visible(t));
                return (
                  <div key={a.id} className="rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                      <b className="text-sm text-brand-800">{p?.project_no ? `${p.project_no} · ` : ''}{p?.name ?? 'Project'}</b>{p && <StatusBadge status={p.status} />}
                      <span className="ml-auto flex gap-2">
                        {editor && <button className="btn-primary btn-sm" onClick={() => setTaskForm({ area_id: a.id })}><Plus size={14} />Add task</button>}
                        {manage && <button className="btn-ghost btn-sm text-red-600" aria-label="Remove project" onClick={() => setDelArea(a.id)}><Trash2 size={14} /></button>}
                      </span>
                    </div>
                    {!rows.length ? <p className="p-3 text-sm text-slate-500">No tasks{status !== 'all' || assignee !== 'all' ? ' match the filters' : ' yet'}.</p> : (
                      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Task', 'Assignee', 'Start date', 'Due date', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                        <tbody>{rows.map((t) => { const late = isOverdue(t, today); return (
                          <tr key={t.id} className="border-t border-slate-100">
                            <td className="td min-w-[14rem] font-medium">{t.title}</td>
                            <td className="td whitespace-nowrap">{t.assignee_id ? emp.get(t.assignee_id)?.name ?? '—' : <span className="text-slate-400">Unassigned</span>}</td>
                            <td className="td whitespace-nowrap">{t.start_date ? fmtDate(t.start_date) : '—'}</td>
                            <td className={`td whitespace-nowrap ${late ? 'font-semibold text-red-600' : ''}`}>{t.due_date ? fmtDate(t.due_date) : '—'}{late && <span className="ml-1 text-xs">overdue</span>}</td>
                            <td className="td">{editor ? <select className="input w-36" value={t.status} aria-label={`Status of ${t.title}`} onChange={(e) => call(() => api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status: e.target.value } }))}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select> : <Badge tone={TONE[t.status] ?? 'gray'}>{t.status}</Badge>}</td>
                            <td className="td whitespace-nowrap">{editor && <><button className="btn-ghost btn-sm" aria-label="Edit task" onClick={() => setTaskForm({ area_id: a.id, task: t })}><Pencil size={14} /></button><button className="btn-ghost btn-sm text-red-600" aria-label="Delete task" onClick={() => setDelTask(t)}><Trash2 size={14} /></button></>}</td>
                          </tr>); })}</tbody></table></div>)}
                  </div>);
              })}
            </div>}
          </section>);
      })}

      {addArea && <AddArea managerId={addArea} onClose={() => setAddArea(null)} onDone={async () => { setAddArea(null); await refresh(); }} />}
      {taskForm && <TaskForm {...taskForm} onClose={() => setTaskForm(null)} onDone={async () => { setTaskForm(null); await refresh(); }} />}
      <Confirm open={!!delTask} title="Delete task" message={`Delete "${delTask?.title}"?`} confirmLabel="Delete" danger onClose={() => setDelTask(null)} onConfirm={() => { const t = delTask!; setDelTask(null); call(() => api(`/api/tasks/${t.id}`, { method: 'DELETE' }), 'Task deleted'); }} />
      <Confirm open={!!delArea} title="Remove project" message={`Remove this project from the area? Its ${tasks.filter((t) => t.area_id === delArea).length} task(s) will be deleted too.`} confirmLabel="Remove" danger onClose={() => setDelArea(null)} onConfirm={() => { const id = delArea!; setDelArea(null); call(() => api(`/api/task-areas/${id}`, { method: 'DELETE' }), 'Project removed'); }} />
    </div>
  );
}

function AddArea({ managerId, onClose, onDone }: { managerId: string; onClose: () => void; onDone: () => void }) {
  const { data } = useApp(); const toast = useToast(); const [pid, setPid] = useState('');
  const used = new Set((data.task_areas ?? []).filter((a) => a.manager_id === managerId).map((a) => a.project_id));
  const opts = managedProjectIds(managerId, data.assignments).filter((id) => !used.has(id)).map((id) => data.projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => (a.project_no ?? '').localeCompare(b.project_no ?? ''));
  const save = async () => { try { await api('/api/task-areas', { body: { manager_id: managerId, project_id: pid } }); toast('Project added'); onDone(); } catch (e: any) { toast(e.message, 'err'); } };
  return <Modal open onClose={onClose} title="Add project" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!pid} onClick={save}>Add</button></>}>
    <Field label="Project (one of this BIM Manager's projects)"><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">— select —</option>{opts.map((p) => <option key={p.id} value={p.id}>{p.project_no ? `${p.project_no} · ` : ''}{p.name}</option>)}</select></Field>
    {!opts.length && <p className="mt-2 text-sm text-slate-500">All of this BIM Manager's projects are already added.</p>}
  </Modal>;
}

function TaskForm({ area_id, task, onClose, onDone }: { area_id: string; task?: Task; onClose: () => void; onDone: () => void }) {
  const { data, emp } = useApp(); const toast = useToast();
  const [f, setF] = useState({ title: task?.title ?? '', start_date: task?.start_date ?? '', due_date: task?.due_date ?? '', assignee_id: task?.assignee_id ?? '', status: task?.status ?? 'Not Started' });
  const area = (data.task_areas ?? []).find((a) => a.id === area_id);
  const team = new Set(data.assignments.filter((a) => a.project_id === area?.project_id).map((a) => a.employee_id));
  const act = data.employees.filter((e) => e.active || e.id === f.assignee_id);
  const bad = !!f.start_date && !!f.due_date && f.due_date < f.start_date;
  const save = async () => {
    const body = { title: f.title, start_date: f.start_date || null, due_date: f.due_date || null, assignee_id: f.assignee_id || null, status: f.status };
    try { if (task) await api(`/api/tasks/${task.id}`, { method: 'PATCH', body }); else await api('/api/tasks', { body: { ...body, area_id } }); toast('Saved'); onDone(); } catch (e: any) { toast(e.message, 'err'); }
  };
  return <Modal open onClose={onClose} title={task ? 'Edit task' : 'Add task'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.title.trim() || bad} onClick={save}>Save</button></>}>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="Task"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
      <Field label="Start date"><input type="date" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
      <Field label="Due date"><input type="date" className="input" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
      {bad && <p className="col-span-2 rounded bg-red-50 p-2 text-sm text-red-700">The due date is before the start date.</p>}
      <Field label="Assignee"><select className="input" value={f.assignee_id} onChange={(e) => setF({ ...f, assignee_id: e.target.value })}><option value="">— unassigned —</option>
        <optgroup label="Project team">{act.filter((e) => team.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
        <optgroup label="Other engineers">{act.filter((e) => !team.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup></select></Field>
      <Field label="Status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
    </div>
  </Modal>;
}
