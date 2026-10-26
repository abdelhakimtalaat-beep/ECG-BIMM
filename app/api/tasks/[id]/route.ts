import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertTaskEditor } from '@/lib/taskPerm';
import { safe, taskCancel, taskInvite } from '@/lib/notify';
import { checkComment, checkDates, taskBody } from '@/lib/taskBody';

const load = async (id: string) => {
  const t = await one<any>('select t.*,t.start_date::text sd,t.due_date::text dd,a.manager_id from tasks t join task_areas a on a.id=t.area_id where t.id=$1', [id]);
  if (!t) throw new ApiError(404, 'Task not found');
  return t;
};
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = taskBody.partial().parse(await json(req));
    const cur = await load(id);
    await assertTaskEditor(me, cur.manager_id);
    checkDates('start_date' in b ? b.start_date : cur.sd, 'due_date' in b ? b.due_date : cur.dd);
    checkComment('status' in b ? b.status! : cur.status, 'comment' in b ? b.comment : cur.comment);
    const keys = Object.keys(b);
    if (!keys.length) throw new ApiError(400, 'Nothing to update');
    if (b.assignee_id && !(await one('select 1 x from employees where id=$1', [b.assignee_id]))) throw new ApiError(404, 'Assignee not found');
    const vals = keys.map((k) => (b as any)[k]);
    await q(`update tasks set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}, updated_at=now() where id=$${vals.length + 1}`, [...vals, id]);
    await audit(null, me.email, b.status && b.status !== cur.status ? 'status' : 'update', 'task', id, b.status && b.status !== cur.status ? `Task "${cur.title}": ${cur.status} → ${b.status}` : `Edited task "${cur.title}"`);
    const next = { ...cur, ...b } as any;
    const by = me.full_name || me.email;
    const mail = await safe(async () => {
      let sent = false;
      if ('assignee_id' in b && cur.assignee_id && cur.assignee_id !== next.assignee_id) sent = await taskCancel({ id, area_id: cur.area_id, title: cur.title, start_date: cur.sd, due_date: cur.dd, assignee_id: cur.assignee_id, comment: cur.comment }, cur.assignee_id);
      const inv = await taskInvite({ id, area_id: cur.area_id, title: next.title, start_date: 'start_date' in b ? b.start_date! : cur.sd, due_date: 'due_date' in b ? b.due_date! : cur.dd, status: next.status, assignee_id: next.assignee_id, comment: next.comment }, by);
      return sent || inv;
    });
    return ok({ mail });
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const cur = await load(id);
    await assertTaskEditor(me, cur.manager_id);
    await q('delete from tasks where id=$1', [id]);
    await audit(null, me.email, 'delete', 'task', id, `Deleted task "${cur.title}"`);
    const mail = await safe(() => taskCancel({ id, area_id: cur.area_id, title: cur.title, start_date: cur.sd, due_date: cur.dd, assignee_id: cur.assignee_id, comment: cur.comment }, cur.assignee_id));
    return ok({ mail });
  });
}
