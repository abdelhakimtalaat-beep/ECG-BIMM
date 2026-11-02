import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = await one<any>('select b.project_id,c.name,p.name pname from process_buildings b join project_contents c on c.id=b.content_id join projects p on p.id=b.project_id where b.id=$1', [id]);
    if (!b) throw new ApiError(404, 'Not found');
    await assertScope(me, b.project_id, 'manager');
    await q('delete from process_buildings where id=$1', [id]);
    await audit(null, me.email, 'delete', 'process_building', id, `${b.pname}: ${b.name} removed from the BIM Process Map`);
    return ok();
  });
}
