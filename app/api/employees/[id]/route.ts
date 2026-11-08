import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { loadDataset } from '@/lib/dataset';
import { wouldCreateCycle } from '@/lib/metrics';

const patch = z.object({
  employee_code: z.string().trim().max(40).nullable(),
  name: z.string().trim().min(1).max(120),
  job_title: z.string().trim().min(1).max(120),
  job_category: z.enum(['department_manager', 'bim_manager', 'bim_coordinator', 'bim_specialist', 'rd_engineer', 'other']),
  discipline: z.string().trim().max(60).nullable(),
  year_value: z.number().int().min(1950).max(2100).nullable(),
  team_location: z.string().trim().max(20).nullable(),
  notes: z.string().max(2000).nullable(),
  mobile: z.string().trim().max(40).nullable().or(z.literal('').transform(() => null)),
  ext: z.string().trim().max(40).nullable().or(z.literal('').transform(() => null)),
  email: z.string().trim().toLowerCase().email().max(200).nullable().or(z.literal('').transform(() => null)),
  active: z.boolean(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), job_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), gender: z.enum(['Male', 'Female']).nullable(),
  education: z.array(z.object({ degree: z.string().trim().max(60), major: z.string().trim().max(80), university: z.string().trim().max(80), year: z.string().trim().max(10) })).max(4),
  reports_to: z.string().uuid().nullable(),
}).partial();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = patch.parse(await json(req));
    const ds = await loadDataset();
    const cur = ds.employees.find((e) => e.id === id);
    if (!cur) throw new ApiError(404, 'Employee not found');
    if ('reports_to' in b && wouldCreateCycle(ds.employees, id, b.reports_to ?? null)) throw new ApiError(400, 'That reporting line would create a loop in the hierarchy');
    await tx(async (c) => {
      const { reports_to, ...cols } = b as any;
      const keys = Object.keys(cols);
      if (keys.length) {
        const vals = keys.map((k) => (k === 'education' ? JSON.stringify(cols[k].filter((r: any) => r.degree || r.major || r.university || r.year)) : cols[k])); vals.push(id);
        await c.query(`update employees set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}, updated_at=now() where id=$${vals.length}`, vals);
      }
      if ('reports_to' in b && (reports_to ?? null) !== cur.reports_to) {
        await c.query('update reporting_relationships set valid_to=current_date where employee_id=$1 and valid_to is null', [id]);
        if (reports_to) await c.query('insert into reporting_relationships(employee_id,manager_id) values($1,$2)', [id, reports_to]);
        const mgr = ds.employees.find((e) => e.id === reports_to);
        await audit(c, me.email, 'transfer', 'employee', id, `${cur.name} now reports to ${mgr?.name ?? '(nobody)'}`, { reports_to: cur.reports_to }, { reports_to });
      }
      if (keys.length) await audit(c, me.email, b.active === false ? 'deactivate' : 'update', 'employee', id, `${b.active === false ? 'Deactivated' : 'Updated'} ${cur.name}`,
        Object.fromEntries(keys.map((k) => [k, (cur as any)[k]])), Object.fromEntries(keys.map((k) => [k, cols[k]])));
    });
    return ok();
  });
}

// Permanently removes an employee from the chart. Direct reports move up to the removed person's manager,
// project assignments of the person are deleted, and a linked portal user is deactivated (never left with access).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const ds = await loadDataset();
    const cur = ds.employees.find((e) => e.id === id);
    if (!cur) throw new ApiError(404, 'Employee not found');
    if (me.employee_id === id) throw new ApiError(400, 'You cannot delete your own employee record');
    const moved = ds.employees.filter((e) => e.reports_to === id);
    await tx(async (c) => {
      for (const r of moved) {
        await c.query('update reporting_relationships set valid_to=current_date where employee_id=$1 and valid_to is null', [r.id]);
        if (cur.reports_to) await c.query('insert into reporting_relationships(employee_id,manager_id) values($1,$2)', [r.id, cur.reports_to]);
      }
      const users = await c.query<{ id: string; role: string }>('select id,role from users where employee_id=$1', [id]);
      for (const u of users.rows) {
        if (u.role === 'admin') {
          const n = await c.query(`select count(*)::int n from users where role='admin' and active and id<>$1`, [u.id]);
          if ((n.rows[0]?.n ?? 0) === 0) throw new ApiError(400, 'This person is the last active administrator and cannot be deleted');
        }
      }
      await c.query('update users set active=false, employee_id=null where employee_id=$1', [id]);
      await c.query('delete from attachments where id in (select attachment_id from employee_documents where employee_id=$1)', [id]);
      await c.query(`delete from attachments where id = any($1::uuid[]) or filename in ($2,$3)`, [[cur.photo_id, cur.cv_id].filter(Boolean), `employee:${id}`, `employee:${id}`]);
      await c.query('delete from employees where id=$1', [id]);
      await audit(c, me.email, 'delete', 'employee', id, `Deleted ${cur.name} from the org chart (${moved.length} direct report(s) moved up)`, cur, null);
    });
    return ok({ moved: moved.length });
  });
}
