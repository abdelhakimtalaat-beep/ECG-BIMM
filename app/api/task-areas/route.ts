import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertAreaManager } from '@/lib/taskPerm';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ manager_id: z.string().uuid().nullish(), team_id: z.string().uuid().nullish(), project_id: z.string().uuid() })
      .refine((x) => !!x.manager_id !== !!x.team_id, 'Give either a BIM Manager or a team').parse(await json(req));
    const owner = { manager_id: b.manager_id ?? null, team_id: b.team_id ?? null };
    await assertAreaManager(me, owner);
    if (owner.manager_id) {
      const own = await q(`select 1 from project_assignments where project_id=$1 and employee_id=$2 and role='manager'`, [b.project_id, owner.manager_id]);
      if (!own.length) throw new ApiError(400, 'The project must be one of this BIM Manager\'s projects');
    }
    if ((await q('select 1 from task_areas where coalesce(manager_id,team_id)=$1 and project_id=$2', [owner.manager_id ?? owner.team_id, b.project_id])).length) throw new ApiError(409, 'This project is already added');
    const r = await one<{ id: string }>('insert into task_areas(manager_id,team_id,project_id,created_by) values($1,$2,$3,$4) returning id', [owner.manager_id, owner.team_id, b.project_id, me.email]);
    const n = await one<any>('select (select name from projects where id=$1) p,coalesce((select name from employees where id=$2),(select name from teams where id=$3)) m', [b.project_id, owner.manager_id, owner.team_id]);
    await audit(null, me.email, 'create', 'task_area', r!.id, `Added project area ${n?.p} to ${n?.m}`);
    return ok({ id: r!.id }, 201);
  });
}
