import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one } from '@/lib/db';
import { assertTaskEditor } from '@/lib/taskPerm';
import { safe, taskInvite } from '@/lib/notify';
import { checkComment, checkDates, taskBody } from '@/lib/taskBody';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = taskBody.extend({ area_id: z.string().uuid() }).parse(await json(req));
    const a = await one<any>('select a.manager_id,p.name pname from task_areas a join projects p on p.id=a.project_id where a.id=$1', [b.area_id]);
    if (!a) throw new ApiError(404, 'Project not found in this area');
    await assertTaskEditor(me, a.manager_id);
    checkDates(b.start_date, b.due_date);
    checkComment(b.status, b.comment);
    if (b.assignee_id && !(await one('select 1 x from employees where id=$1', [b.assignee_id]))) throw new ApiError(404, 'Assignee not found');
    const r = await one<{ id: string }>('insert into tasks(area_id,title,start_date,due_date,assignee_id,status,comment,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning id', [b.area_id, b.title, b.start_date, b.due_date, b.assignee_id, b.status, b.comment || null, me.email]);
    await audit(null, me.email, 'create', 'task', r!.id, `Task "${b.title}" added to ${a.pname}`);
    const mail = await safe(() => taskInvite({ id: r!.id, area_id: b.area_id, title: b.title, start_date: b.start_date, due_date: b.due_date, status: b.status, assignee_id: b.assignee_id, comment: b.comment }, me.full_name || me.email));
    return ok({ id: r!.id, mail }, 201);
  });
}
