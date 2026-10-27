import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

// Toggles the signed-in user's vote on an idea.
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    if (!(await one('select 1 x from wishes where id=$1', [id]))) throw new ApiError(404, 'Idea not found');
    const del = await q('delete from wish_votes where wish_id=$1 and user_id=$2 returning 1', [id, me.id]);
    if (!del.length) await q('insert into wish_votes(wish_id,user_id) values($1,$2) on conflict do nothing', [id, me.id]);
    return ok({ voted: !del.length });
  });
}
