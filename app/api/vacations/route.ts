import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { vacationBody } from '@/lib/vacationBody';
import { vacationDays } from '@/lib/vacations';

export const dynamic = 'force-dynamic';
/** Everyone sees his own requests; the Administrator sees all of them. */
export async function GET() {
  return handle(async () => {
    const me = await requireTab('/vacations');
    const admin = me.role === 'admin';
    if (!admin && !me.employee_id) return ok({ requests: [], can_request: false, all: false });
    const rows = await q<any>(`select id,employee_id,start_date::text start_date,end_date::text end_date,days,replacement_id,notes,location,auto_reply,created_at from vacation_requests ${admin ? '' : 'where employee_id=$1'} order by start_date desc, created_at desc`, admin ? [] : [me.employee_id]);
    return ok({ requests: rows, can_request: !!me.employee_id, all: admin });
  });
}
/** Any employee requests a vacation for himself; the number of days is calculated here. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireTab('/vacations');
    if (!me.employee_id) throw new ApiError(403, 'Your account is not linked to an employee record, so you cannot request a vacation');
    const b = vacationBody.parse(await json(req));
    if (b.replacement_id === me.employee_id) throw new ApiError(400, 'You cannot be your own replacement');
    if (b.replacement_id && !(await one('select 1 as x from employees where id=$1 and active', [b.replacement_id]))) throw new ApiError(400, 'Replacement not found');
    const days = vacationDays(b.start_date, b.end_date);
    const r = await one<{ id: string }>('insert into vacation_requests(employee_id,start_date,end_date,days,replacement_id,notes,location,auto_reply,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [me.employee_id, b.start_date, b.end_date, days, b.replacement_id, b.notes, b.location, !!b.auto_reply, me.email]);
    await audit(null, me.email, 'create', 'vacation', r!.id, `Vacation request ${b.start_date} to ${b.end_date} (${days} days)`);
    return ok({ id: r!.id }, 201);
  });
}
