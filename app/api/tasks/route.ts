import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one } from '@/lib/db';
import { assertTaskEditor } from '@/lib/taskPerm';
import { checkDates, taskBody } from '@/lib/taskBody';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = taskBody.extend({ area_id: z.string().uuid() }).parse(await json(req));
    const a = await one<any>('select a.manager_id,p.name pname from task_areas a join projects p on p.id=a.project_id where a.id=$1', [b.area_id]);
    if (!a) throw new ApiError(404, 'Sub-area not found');
    await assertTaskEditor(me, a.manager_id);
    checkDates(b.start_date, b.due_date);
    if (b.assignee_id && !(await one('select 1 x from employees where id=$1', [b.assignee_id]))) throw new ApiError(404, 'Assignee not found');
    const r = await one<{ id: string }>('insert into tasks(area_id,title,start_date,due_date,assignee_id,status,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id', [b.area_id, b.title, b.start_date, b.due_date, b.assignee_id, b.status, me.email]);
    await audit(null, me.email, 'create', 'task', r!.id, `Task "${b.title}" added to ${a.pname}`);
    return ok({ id: r!.id }, 201);
  });
}
