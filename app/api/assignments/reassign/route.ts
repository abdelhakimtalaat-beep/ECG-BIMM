// Applies a reassignment. The workload "simulation" never calls this; it is client-side only and needs an explicit confirm.
import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ project_id: z.string().uuid(), role: z.enum(['manager', 'coordinator']), from_employee_id: z.string().uuid().nullable(), to_employee_id: z.string().uuid(), confirm: z.literal(true) }).parse(await json(req));
    if (me.role !== 'admin') throw new ApiError(403, 'Only the Department Manager can change team assignments');
    await tx(async (c) => {
      const n = (await c.query('select (select name from projects where id=$1) p,(select name from employees where id=$2) t,(select name from employees where id=$3) f', [b.project_id, b.to_employee_id, b.from_employee_id])).rows[0];
      if (!n.p || !n.t) throw new ApiError(404, 'Project or employee not found');
      if (b.from_employee_id) await c.query('delete from project_assignments where project_id=$1 and employee_id=$2 and role=$3', [b.project_id, b.from_employee_id, b.role]);
      await c.query('insert into project_assignments(project_id,employee_id,role) values($1,$2,$3) on conflict do nothing', [b.project_id, b.to_employee_id, b.role]);
      await audit(c, me.email, 'reassign', 'project', b.project_id, `${n.p}: ${b.role} ${n.f ?? '(none)'} → ${n.t}`);
    });
    return ok();
  });
}
