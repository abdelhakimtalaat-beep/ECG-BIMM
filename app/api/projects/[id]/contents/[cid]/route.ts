import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id, cid } = await ctx.params; z.string().uuid().parse(id); z.string().uuid().parse(cid);
    await assertScope(me, id, 'manager');
    const c = await one<any>('select c.name,c.kind,p.name pname from project_contents c join projects p on p.id=c.project_id where c.id=$1 and c.project_id=$2', [cid, id]);
    if (!c) throw new ApiError(404, 'Content not found');
    await q('delete from project_contents where id=$1', [cid]); // its process map (if any) goes with it
    await audit(null, me.email, 'delete', 'project_content', cid, `${c.pname}: content removed — ${c.kind} ${c.name}`);
    return ok();
  });
}
