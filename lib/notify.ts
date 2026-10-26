// E-mail notifications with calendar invitations (.ics) for tasks and BIM Reels. Never blocks or fails the request.
import { one } from './db';
import { buildIcs } from './ics';
import { mailEnabled, sendMail } from './mailer';

export type MailResult = 'sent' | 'skipped' | 'failed' | 'off';
const DOMAIN = 'ecg-bim-portal';
const organizer = () => ({ email: process.env.SMTP_USER ?? '', name: process.env.SMTP_FROM_NAME ?? 'ECG BIM Portal' });

export async function safe(fn: () => Promise<boolean>): Promise<MailResult> {
  if (!mailEnabled()) return 'off';
  try { return (await fn()) ? 'sent' : 'skipped'; } catch (e: any) { console.error('mail failed:', e?.message); return 'failed'; }
}
const person = (id: string | null) => (id ? one<{ name: string; email: string | null }>('select name,email from employees where id=$1', [id]) : Promise.resolve(null));
const nowSeq = () => Math.floor(Date.now() / 1000);

interface TaskLite { id: string; title: string; start_date: string | null; due_date: string | null; status: string; assignee_id: string | null; area_id: string }
async function taskCtx(areaId: string) {
  return one<{ pname: string; mname: string }>('select p.name pname,(select name from employees where id=a.manager_id) mname from task_areas a join projects p on p.id=a.project_id where a.id=$1', [areaId]);
}
/** New or changed task -> invitation to the assignee. Returns false when nothing was sent (no assignee, no e-mail). */
export async function taskInvite(t: TaskLite, by: string): Promise<boolean> {
  const a = await person(t.assignee_id); if (!a?.email) return false;
  const c = await taskCtx(t.area_id); const org = organizer();
  const done = t.status === 'Completed';
  const when = t.start_date || t.due_date;
  const summary = `${done ? '[Completed] ' : ''}Task: ${t.title} — ${c?.pname ?? ''}`;
  const lines = [`Hello ${a.name},`, '', 'A task assigned to you was created or updated in the ECG BIM Portal.', '', `Task: ${t.title}`, `Project: ${c?.pname ?? '—'}`, `BIM Manager: ${c?.mname ?? '—'}`,
    `Start date: ${t.start_date ?? '—'}`, `Due date: ${t.due_date ?? '—'}`, `Status: ${t.status}`, `Updated by: ${by}`];
  await sendMail({ to: a.email, subject: `${done ? 'Completed' : 'Task'}: ${t.title}`, text: lines.join('\n'),
    ics: when ? { method: 'REQUEST', content: buildIcs({ uid: `task-${t.id}@${DOMAIN}`, seq: nowSeq(), method: 'REQUEST', summary, description: lines.slice(4, 9).join('\n'), start: when, end: t.due_date ?? when, organizerEmail: org.email, organizerName: org.name, attendeeEmail: a.email, attendeeName: a.name }) } : undefined });
  return true;
}
/** Task deleted, or reassigned to somebody else -> remove it from the previous assignee's calendar. */
export async function taskCancel(t: Omit<TaskLite, 'status'>, assigneeId: string | null): Promise<boolean> {
  const a = await person(assigneeId); if (!a?.email) return false;
  const org = organizer(); const when = t.start_date || t.due_date;
  await sendMail({ to: a.email, subject: `Cancelled: ${t.title}`, text: `Hello ${a.name},\n\nThe task "${t.title}" is no longer assigned to you.`,
    ics: when ? { method: 'CANCEL', content: buildIcs({ uid: `task-${t.id}@${DOMAIN}`, seq: nowSeq(), method: 'CANCEL', summary: `Task: ${t.title}`, start: when, end: t.due_date ?? when, organizerEmail: org.email, organizerName: org.name, attendeeEmail: a.email, attendeeName: a.name }) } : undefined });
  return true;
}

interface ReelLite { id: string; employee_id: string | null; session_date: string; topic: string | null; software: string | null; link: string | null; status: string; presenter_name: string }
/** Planned reel -> invitation to the speaker; Cancelled reel -> removal. Other statuses send nothing. */
export async function reelInvite(r: ReelLite): Promise<boolean> {
  if (r.status !== 'Planned' && r.status !== 'Cancelled') return false;
  const a = await person(r.employee_id); if (!a?.email) return false;
  const org = organizer(); const cancel = r.status === 'Cancelled';
  const what = r.topic || 'BIM Reel session';
  const lines = [`Hello ${a.name},`, '', cancel ? 'Your BIM Reel session has been cancelled.' : 'You are scheduled to present a BIM Reel.', '', `Date: ${r.session_date}`, `Topic: ${r.topic ?? '—'}`, `Software: ${r.software ?? '—'}`, ...(r.link ? [`Link: ${r.link}`] : [])];
  await sendMail({ to: a.email, subject: `${cancel ? 'Cancelled: ' : ''}BIM Reel ${r.session_date}: ${what}`, text: lines.join('\n'),
    ics: { method: cancel ? 'CANCEL' : 'REQUEST', content: buildIcs({ uid: `reel-${r.id}@${DOMAIN}`, seq: nowSeq(), method: cancel ? 'CANCEL' : 'REQUEST', summary: `BIM Reel: ${what}`, description: lines.slice(4).join('\n'), start: r.session_date, organizerEmail: org.email, organizerName: org.name, attendeeEmail: a.email, attendeeName: a.name }) } });
  return true;
}
/** Reel deleted or given to another speaker -> remove it from the old speaker's calendar. */
export const reelCancel = (r: ReelLite) => reelInvite({ ...r, status: 'Cancelled' });
