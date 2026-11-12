// E-mails of the vacation workflow (never block or fail the request).
import { one, q } from './db';
import { sendMail } from './mailer';
import { safe } from './notify';
import { VAC_STATUS_LABEL, type VacStatus } from './vacations';

export interface VacMailData { id: string; employee: string; start_date: string; end_date: string; days: number; replacement: string; notes: string | null; location: string; auto_reply: boolean }
const detail = (v: VacMailData) => [`Employee: ${v.employee}`, `From: ${v.start_date}`, `To: ${v.end_date}`, `Number of days: ${v.days}`, `Replacement: ${v.replacement}`, `Important notes for the replacement: ${v.notes || '—'}`, `Location during the vacation: ${v.location}`, ...(v.auto_reply ? ['An automatic email reply should be sent to related teams during the vacation (confirmed).'] : [])];
export const deptManagers = (exceptId: string) => q<{ id: string; name: string; email: string | null }>(`select id,name,email from employees where job_category='department_manager' and active and id<>$1`, [exceptId]);
export const personOf = (id: string | null) => (id ? one<{ id: string; name: string; email: string | null }>('select id,name,email from employees where id=$1', [id]) : Promise.resolve(null));
const send = (to: { email: string | null } | null | undefined, subject: string, lines: string[]) => safe(async () => { if (!to?.email) return false; await sendMail({ to: to.email, subject, text: lines.join('\n') }); return true; });
const sendAll = (to: ({ email: string | null } | null)[], subject: string, lines: (n: any) => string[]) => { const seen = new Set<string>(); return Promise.all(to.filter((p): p is { email: string; name?: string } => !!p?.email && !seen.has(p.email.toLowerCase()) && !!seen.add(p.email.toLowerCase())).map((p) => send(p, subject, lines(p)))); };

/** New request: the replacement is informed; the approvers are asked to decide. */
export async function mailNewRequest(v: VacMailData, route: 'manager' | 'department', manager: { name: string; email: string | null } | null, depts: { name: string; email: string | null }[], replacement: { name: string; email: string | null } | null) {
  const d = detail(v);
  await send(replacement, `Vacation of ${v.employee}: you are the replacement`, [`Hello ${replacement?.name ?? ''},`, '', `${v.employee} requested a vacation and you were named as the replacement (for your information).`, '', ...d]);
  if (route === 'manager') {
    await send(manager, `Vacation approval needed: ${v.employee}`, [`Hello ${manager?.name ?? ''},`, '', `${v.employee} requested a vacation. Please approve or reject it in the portal (BIMMers > Vacations). After your approval it goes to the department manager.`, '', ...d]);
    await sendAll(depts, `Vacation request of ${v.employee} (department manager approval will follow)`, (p) => [`Hello ${p.name},`, '', `${v.employee} requested a vacation. It is waiting for the direct manager first; you will be asked to approve it after that.`, '', ...d]);
  } else await sendAll(depts, `Vacation approval needed: ${v.employee}`, (p) => [`Hello ${p.name},`, '', `${v.employee} requested a vacation. Please approve or reject it in the portal (BIMMers > Vacations).`, '', ...d]);
}
/** The direct manager approved: the department managers are asked to decide. */
export const mailToDepartment = (v: VacMailData, by: string, depts: { name: string; email: string | null }[]) =>
  sendAll(depts, `Vacation approval needed: ${v.employee}`, (p) => [`Hello ${p.name},`, '', `The direct manager (${by}) approved the vacation of ${v.employee}. Please approve or reject it in the portal (BIMMers > Vacations).`, '', ...detail(v)]);
/** Final result (or a rejection at any step): requester and replacement are told. */
export async function mailResult(v: VacMailData, status: VacStatus, by: string, comment: string | null, requester: { name: string; email: string | null } | null, replacement: { name: string; email: string | null } | null) {
  const head = status === 'approved' ? 'was approved' : 'was rejected'; const extra = comment ? ['', `Comment: ${comment}`] : [];
  await send(requester, `Vacation ${status === 'approved' ? 'approved' : 'rejected'}: ${v.start_date} to ${v.end_date}`, [`Hello ${requester?.name ?? ''},`, '', `Your vacation request ${head} (${VAC_STATUS_LABEL[status]}; decided by ${by}).`, ...extra, '', ...detail(v)]);
  if (status === 'approved') await send(replacement, `Vacation of ${v.employee} approved: you are the replacement`, [`Hello ${replacement?.name ?? ''},`, '', `The vacation of ${v.employee} was approved. You are the replacement (for your information).`, '', ...detail(v)]);
}
