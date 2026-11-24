import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one } from '@/lib/db';
import { assertAreaEditor } from '@/lib/taskPerm';
import { safe, taskInvite } from '@/lib/notify';
import { checkComment, checkDates, taskBody } from '@/lib/taskBody';
import { REPEAT_MAX, occurrences } from '@/lib/taskRepeat';
import { tx } from '@/lib/db';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = taskBody.extend({ area_id: z.string().uuid(), repeat: z.object({ freq: z.enum(['daily', 'weekly', 'monthly', 'days']), weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullish() }).parse(await json(req));
    const a = await one<any>('select a.manager_id,a.team_id,p.name pname from task_areas a join projects p on p.id=a.project_id where a.id=$1', [b.area_id]);
    if (!a) throw new ApiError(404, 'Project not found in this area');
    await assertAreaEditor(me, a);
    checkDates(b.start_date, b.due_date);
    checkComment(b.status, b.comment);
    if (b.assignee_id && !(await one('select 1 x from employees where id=$1', [b.assignee_id]))) throw new ApiError(404, 'Assignee not found');
    if (b.repeat) {
      /* repeating task: one normal task for every date, all sharing a series id */
      const r = b.repeat; if (!(b.start_date ?? b.due_date)) throw new ApiError(400, 'Set a start or due date to repeat the task');
      if (r.freq === 'days' && !r.weekdays?.length) throw new ApiError(400, 'Choose the days of the week');
      const occ = occurrences(b.start_date, b.due_date, { freq: r.freq, weekdays: r.weekdays, until: r.until });
      if (!occ.length) throw new ApiError(400, 'The repeat end date must be on or after the first date');
      if (occ.length > REPEAT_MAX) throw new ApiError(400, `This would create more than ${REPEAT_MAX} tasks. Choose an earlier end date`);
      const series = crypto.randomUUID(); const ids: string[] = [];
      await tx(async (c) => { for (let i = 0; i < occ.length; i++) ids.push((await c.query('insert into tasks(area_id,title,start_date,due_date,assignee_id,status,comment,building_no,created_by,series_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id', [b.area_id, b.title, occ[i].start, occ[i].due, b.assignee_id, i === 0 ? b.status : 'Not Started', b.comment, b.building_no, me.email, series])).rows[0].id); });
      await audit(null, me.email, 'create', 'task', ids[0], `Repeating task "${b.title}" added to ${a.pname}: ${occ.length} tasks`);
      const mail = await safe(() => taskInvite({ id: ids[0], area_id: b.area_id, title: b.title, start_date: occ[0].start, due_date: occ[0].due, status: b.status, assignee_id: b.assignee_id, comment: b.comment, building_no: b.building_no }, me.full_name || me.email));   /* one invitation for the first occurrence only */
      return ok({ id: ids[0], count: occ.length, mail }, 201);
    }
    const r = await one<{ id: string }>('insert into tasks(area_id,title,start_date,due_date,assignee_id,status,comment,building_no,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [b.area_id, b.title, b.start_date, b.due_date, b.assignee_id, b.status, b.comment || null, b.building_no, me.email]);
    await audit(null, me.email, 'create', 'task', r!.id, `Task "${b.title}" added to ${a.pname}`);
    const mail = await safe(() => taskInvite({ id: r!.id, area_id: b.area_id, title: b.title, start_date: b.start_date, due_date: b.due_date, status: b.status, assignee_id: b.assignee_id, comment: b.comment, building_no: b.building_no }, me.full_name || me.email));
    return ok({ id: r!.id, mail }, 201);
  });
}
