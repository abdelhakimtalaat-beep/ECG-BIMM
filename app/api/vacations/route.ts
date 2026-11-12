import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { deptManagerIds } from '@/lib/evaluationServer';
import { deptManagers, mailNewRequest, personOf } from '@/lib/vacationMail';
import { vacationBody } from '@/lib/vacationBody';
import { canDecideVacation, initialStatus, vacationDays, vacationRoute } from '@/lib/vacations';

export const dynamic = 'force-dynamic';
const COLS = `v.id,v.employee_id,v.start_date::text start_date,v.end_date::text end_date,v.days,v.replacement_id,v.notes,v.location,v.auto_reply,v.status,v.manager_id,v.manager_decision,v.manager_decided_at,v.manager_comment,v.dept_decision,v.dept_decided_by,v.dept_decided_at,v.dept_comment,v.created_at`;
/** Own requests, requests that name you as replacement or that wait for you; the Administrator and the department managers see all of them. */
export async function GET() {
  return handle(async () => {
    const me = await requireTab('/vacations'); const admin = me.role === 'admin';
    const isDept = !!me.employee_id && (await deptManagerIds()).includes(me.employee_id);
    if (!admin && !me.employee_id) return ok({ requests: [], can_request: false, all: false });
    const all = admin || isDept;
    const rows = await q<any>(`select ${COLS} from vacation_requests v ${all ? '' : 'where v.employee_id=$1 or v.replacement_id=$1 or v.manager_id=$1'} order by v.start_date desc, v.created_at desc`, all ? [] : [me.employee_id]);
    const actor = { employee_id: me.employee_id, role: me.role, isDeptManager: isDept };
    return ok({ requests: rows.map((r: any) => ({ ...r, can_decide: canDecideVacation(actor, r) })), can_request: !!me.employee_id, all });
  });
}
/** Any employee requests a vacation for himself; the number of days is calculated here. The replacement is informed and the approvers are asked by e-mail. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireTab('/vacations');
    if (!me.employee_id) throw new ApiError(403, 'Your account is not linked to an employee record, so you cannot request a vacation');
    const b = vacationBody.parse(await json(req));
    if (b.replacement_id === me.employee_id) throw new ApiError(400, 'You cannot be your own replacement');
    const rep = await personOf(b.replacement_id); if (!rep) throw new ApiError(400, 'Replacement not found');
    const emp = await one<{ name: string; job_category: string; manager_id: string | null; manager_category: string | null }>(`select e.name,e.job_category,r.manager_id,m.job_category manager_category from employees e left join reporting_relationships r on r.employee_id=e.id and r.valid_to is null left join employees m on m.id=r.manager_id where e.id=$1 limit 1`, [me.employee_id]);
    if (!emp) throw new ApiError(400, 'Employee not found');
    const route = vacationRoute(emp.job_category, emp.manager_id, emp.manager_category); const days = vacationDays(b.start_date, b.end_date);
    const r = await one<{ id: string }>('insert into vacation_requests(employee_id,start_date,end_date,days,replacement_id,notes,location,auto_reply,created_by,status,manager_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id', [me.employee_id, b.start_date, b.end_date, days, b.replacement_id, b.notes, b.location, !!b.auto_reply, me.email, initialStatus(route), route === 'manager' ? emp.manager_id : null]);
    await audit(null, me.email, 'create', 'vacation', r!.id, `Vacation request ${b.start_date} to ${b.end_date} (${days} days)`);
    await mailNewRequest({ id: r!.id, employee: emp.name, start_date: b.start_date, end_date: b.end_date, days, replacement: rep.name, notes: b.notes, location: b.location, auto_reply: !!b.auto_reply }, route, route === 'manager' ? await personOf(emp.manager_id) : null, await deptManagers(me.employee_id), rep).catch((e) => console.error('mail failed:', e?.message));
    return ok({ id: r!.id, route }, 201);
  });
}
