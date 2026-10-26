import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertSubAreaManager } from '@/lib/taskPerm';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ manager_id: z.string().uuid(), project_id: z.string().uuid() }).parse(await json(req));
    assertSubAreaManager(me, b.manager_id);
    const own = await q(`select 1 from project_assignments where project_id=$1 and employee_id=$2 and role='manager'`, [b.project_id, b.manager_id]);
    if (!own.length) throw new ApiError(400, 'The project must be one of this BIM Manager\'s projects');
    if ((await q('select 1 from task_areas where manager_id=$1 and project_id=$2', [b.manager_id, b.project_id])).length) throw new ApiError(409, 'This project is already added');
    const r = await one<{ id: string }>('insert into task_areas(manager_id,project_id,created_by) values($1,$2,$3) returning id', [b.manager_id, b.project_id, me.email]);
    const n = await one<any>('select (select name from projects where id=$1) p,(select name from employees where id=$2) m', [b.project_id, b.manager_id]);
    await audit(null, me.email, 'create', 'task_area', r!.id, `Added project area ${n?.p} to ${n?.m}`);
    return ok({ id: r!.id }, 201);
  });
}
