import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { canCreate, isAdmin, totals, visibleStages, type Stage } from '@/lib/evaluation';
import { actorsFor, deptManagerIds, whoOf } from '@/lib/evaluationServer';

export const dynamic = 'force-dynamic';
/** The forms the person may see, with the totals of the stages he may see. */
export async function GET() {
  return handle(async () => {
    const me = await requireTab('/evaluation'); const who = whoOf(me);
    const [evs, mgr, depts] = await Promise.all([
      q<any>("select e.id,e.employee_id,e.period,e.status,e.updated_at,e.info->>'skip_manager' as skip_manager,nullif(e.info->>'late_hours','')::numeric as late_hours from evaluations e order by e.period desc, e.created_at"),
      q<any>('select employee_id,manager_id from reporting_relationships where valid_to is null'), deptManagerIds(),
    ]);
    const managerOf = new Map(mgr.map((r: any) => [r.employee_id, r.manager_id as string]));
    const mine = evs.map((e: any) => ({ e, a: { employeeId: e.employee_id, managerId: managerOf.get(e.employee_id) ?? null, deptIds: depts, skipManager: e.skip_manager === 'true' } })).map((x: any) => ({ ...x, vis: (visibleStages(who, x.a, x.e.status) as Stage[] | null)?.filter((s) => !(x.a.skipManager && s === 'manager')) ?? null })).filter((x: any) => x.vis);
    const ids = mine.map((x: any) => x.e.id);
    const sc = ids.length ? await q<any>('select evaluation_id,stage,item_key,score from evaluation_scores where evaluation_id = any($1::uuid[]) and score is not null', [ids]) : [];
    const by = new Map<string, Record<string, Record<string, number>>>();
    for (const r of sc) { const m = by.get(r.evaluation_id) ?? by.set(r.evaluation_id, {}).get(r.evaluation_id)!; (m[r.stage] ??= {})[r.item_key] = Number(r.score); }
    const rows = mine.map(({ e, vis }: any) => ({ id: e.id, employee_id: e.employee_id, period: e.period, status: e.status, updated_at: e.updated_at, late_hours: e.late_hours == null ? null : Number(e.late_hours),
      totals: Object.fromEntries(vis.map((s: Stage) => { const t = totals(by.get(e.id)?.[s] ?? {}); return [s, { total: t.total, level: t.level, rated: t.rated }]; })) }));
    return ok({ evaluations: rows, can_create: isAdmin(me) || me.role === 'bim_manager' || (!!me.employee_id && depts.includes(me.employee_id)) });
  });
}

const EMPTY_INFO = (loc: string | null) => ({ location: loc ?? '', employment_date: '', department: 'BIM MANAGEMENT DEPARTMENT', section: '', vacation_days: null, sick_days: null, late_hours: null, education: [] });
/** Creates the form of one employee, or (all:true) of every active employee of the org chart that has none yet for the period. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); const who = whoOf(me);
    const b = z.object({ period: z.string().trim().min(1).max(30), all: z.boolean().optional(), employee_id: z.string().uuid().optional() }).parse(await json(req));
    const depts = await deptManagerIds();
    if (b.all) {
      if (!isAdmin(me) && !(me.employee_id && depts.includes(me.employee_id))) throw new ApiError(403, 'Only the Administrator or the Department Manager can create forms for everybody');
      const r = await q<{ id: string }>(`insert into evaluations(employee_id,period,info,created_by) select e.id,$1,jsonb_build_object('location',coalesce(e.team_location,''),'employment_date','','department','BIM MANAGEMENT DEPARTMENT','section','','vacation_days',null,'sick_days',null,'late_hours',null,'education','[]'::jsonb),$2 from employees e where e.active on conflict (employee_id,period) do nothing returning id`, [b.period, me.email]);
      await audit(null, me.email, 'create', 'evaluation', null, `Created ${r.length} evaluation form(s) for ${b.period}`);
      return ok({ created: r.length }, 201);
    }
    if (!b.employee_id) throw new ApiError(400, 'Choose an engineer');
    const empId: string = b.employee_id;
    const emp = await q<any>('select id,name,team_location from employees where id=$1', [empId]);
    if (!emp[0]) throw new ApiError(404, 'Employee not found');
    if (!canCreate(who, await actorsFor(empId, depts))) throw new ApiError(403, 'You cannot create an evaluation for this employee');
    const r = await q<{ id: string }>('insert into evaluations(employee_id,period,info,created_by) values($1,$2,$3,$4) on conflict (employee_id,period) do nothing returning id', [empId, b.period, JSON.stringify(EMPTY_INFO(emp[0].team_location)), me.email]);
    if (!r[0]) throw new ApiError(409, `${emp[0].name} already has an evaluation for ${b.period}`);
    await audit(null, me.email, 'create', 'evaluation', r[0].id, `Created evaluation ${b.period} for ${emp[0].name}`);
    return ok({ id: r[0].id }, 201);
  });
}
