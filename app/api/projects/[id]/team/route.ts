// Sets the BIM Manager or BIM Coordinator of a project (Administrator only). Replaces whoever held that role.
import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = z.object({ role: z.enum(['manager', 'coordinator']), employee_id: z.string().uuid().nullable() }).parse(await json(req));
    await tx(async (c) => {
      const p = (await c.query('select name from projects where id=$1', [id])).rows[0];
      if (!p) throw new ApiError(404, 'Project not found');
      let en = '(none)';
      if (b.employee_id) {
        const e = (await c.query('select name,active,job_category from employees where id=$1', [b.employee_id])).rows[0];
        if (!e) throw new ApiError(404, 'Employee not found');
        if (b.role === 'manager' && !['bim_manager', 'department_manager'].includes(e.job_category)) throw new ApiError(400, 'A BIM Manager must be a BIM Manager or the Department Manager');
        en = e.name;
      }
      const before = (await c.query(`select string_agg(e.name, ', ') n from project_assignments a join employees e on e.id=a.employee_id where a.project_id=$1 and a.role=$2`, [id, b.role])).rows[0]?.n ?? '(none)';
      await c.query('delete from project_assignments where project_id=$1 and role=$2', [id, b.role]);
      if (b.employee_id) {
        await c.query(`delete from project_assignments where project_id=$1 and employee_id=$2 and role='member'`, [id, b.employee_id]);
        await c.query('insert into project_assignments(project_id,employee_id,role) values($1,$2,$3) on conflict do nothing', [id, b.employee_id, b.role]);
      }
      await audit(c, me.email, 'reassign', 'project', id, `${p.name}: ${b.role} ${before} → ${en}`);
    });
    return ok();
  });
}
