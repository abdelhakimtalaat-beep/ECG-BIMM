import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { deptManagerIds } from '@/lib/evaluationServer';
import { deptManagers, mailResult, mailToDepartment, personOf } from '@/lib/vacationMail';
import { decisionBody } from '@/lib/vacationBody';
import { afterDecision, canDecideVacation, type VacStatus } from '@/lib/vacations';

/** Approve or reject: the direct manager first, then a department manager (BIM managers' requests go to the department manager directly). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/vacations'); const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = decisionBody.parse(await json(req));
    const v = await one<any>(`select v.*,v.start_date::text sd,v.end_date::text ed,e.name ename from vacation_requests v join employees e on e.id=v.employee_id where v.id=$1`, [id]);
    if (!v) throw new ApiError(404, 'Request not found');
    const actor = { employee_id: me.employee_id, role: me.role, isDeptManager: !!me.employee_id && (await deptManagerIds()).includes(me.employee_id) };
    if (!canDecideVacation(actor, v)) throw new ApiError(403, 'This request is not waiting for your decision');
    const next: VacStatus = afterDecision(v.status, b.approve); const by = (me.employee_id ? (await personOf(me.employee_id))?.name : null) ?? me.email;
    if (v.status === 'pending_manager') await q(`update vacation_requests set status=$2,manager_decision=$3,manager_decided_at=now(),manager_comment=$4 where id=$1`, [id, next, b.approve ? 'approved' : 'rejected', b.comment]);
    else await q(`update vacation_requests set status=$2,dept_decision=$3,dept_decided_at=now(),dept_decided_by=$5,dept_comment=$4 where id=$1`, [id, next, b.approve ? 'approved' : 'rejected', b.comment, by]);
    await audit(null, me.email, 'update', 'vacation', id, `Vacation of ${v.ename} ${v.sd} to ${v.ed}: ${b.approve ? 'approved' : 'rejected'} by ${by}; now: ${next}`);
    const rep = await personOf(v.replacement_id); const mail = { id, employee: v.ename, start_date: v.sd, end_date: v.ed, days: v.days, replacement: rep?.name ?? '—', notes: v.notes, location: v.location ?? '', auto_reply: v.auto_reply };
    try {
      if (next === 'pending_department') await mailToDepartment(mail, by, await deptManagers(v.employee_id));
      else await mailResult(mail, next, by, b.comment, await personOf(v.employee_id), rep);
    } catch (e: any) { console.error('mail failed:', e?.message); }
    return ok({ status: next });
  });
}
