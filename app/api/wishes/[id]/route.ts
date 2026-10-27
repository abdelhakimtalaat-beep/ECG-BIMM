import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { WISH_AREAS, WISH_STATUSES, canEditWish, canManageWish } from '@/lib/wishes';

const patch = z.object({
  title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).nullable(), area: z.enum(WISH_AREAS).nullable(),
  status: z.enum(WISH_STATUSES), admin_note: z.string().trim().max(2000).nullable(),
}).partial();
const load = async (id: string) => { const w = await one<any>('select id,title,status,author_id from wishes where id=$1', [id]); if (!w) throw new ApiError(404, 'Idea not found'); return w; };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = patch.parse(await json(req));
    const w = await load(id);
    const keys = Object.keys(b);
    if (!keys.length) throw new ApiError(400, 'Nothing to update');
    if (keys.some((k) => k === 'status' || k === 'admin_note') && !canManageWish(me.role)) throw new ApiError(403, 'Only the Administrator can set the status or reply');
    if (keys.some((k) => k === 'title' || k === 'description' || k === 'area') && !canEditWish(me.role, me.id, w)) throw new ApiError(403, 'You can only edit your own idea while it is still New');
    const vals = keys.map((k) => (b as any)[k] || null);
    await q(`update wishes set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}, updated_at=now() where id=$${vals.length + 1}`, [...vals, id]);
    await audit(null, me.email, b.status && b.status !== w.status ? 'status' : 'update', 'wish', id, b.status && b.status !== w.status ? `Wish "${w.title}": ${w.status} → ${b.status}` : `Edited wish "${w.title}"`);
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const w = await load(id);
    if (!canEditWish(me.role, me.id, w)) throw new ApiError(403, 'You can only delete your own idea while it is still New');
    await q('delete from wishes where id=$1', [id]);
    await audit(null, me.email, 'delete', 'wish', id, `Deleted wish "${w.title}"`);
    return ok();
  });
}
