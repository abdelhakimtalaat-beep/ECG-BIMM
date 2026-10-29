import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertAreaManager } from '@/lib/taskPerm';

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const a = await one<any>('select a.manager_id,a.team_id,p.name pname,(select count(*) from tasks t where t.area_id=a.id)::int n from task_areas a join projects p on p.id=a.project_id where a.id=$1', [id]);
    if (!a) throw new ApiError(404, 'Project not found in this area');
    await assertAreaManager(me, a);
    await q('delete from task_areas where id=$1', [id]);
    await audit(null, me.email, 'delete', 'task_area', id, `Removed project area ${a.pname} (${a.n} tasks)`);
    return ok();
  });
}
