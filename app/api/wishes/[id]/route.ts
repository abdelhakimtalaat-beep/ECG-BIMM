import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { mailWishAuthor, type WishAction } from '@/lib/wishMail';
import { WISH_AREAS, WISH_STATUSES, canEditWish, canManageWish } from '@/lib/wishes';

const patch = z.object({
  title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).nullable(), area: z.enum(WISH_AREAS).nullable(),
  status: z.enum(WISH_STATUSES), admin_note: z.string().trim().max(2000).nullable(),
}).partial();
const load = async (id: string) => { const w = await one<any>('select id,title,status,author_id,admin_note,description,area from wishes where id=$1', [id]); if (!w) throw new ApiError(404, 'Idea not found'); return w; };

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
    /* tell the person who proposed the idea (not when he made the change himself) */
    const who = { id: me.id, name: me.full_name || me.email };
    const reply = 'admin_note' in b && (b.admin_note ?? null) !== (w.admin_note ?? null);
    const action: WishAction | null = b.status && b.status !== w.status ? { kind: 'status', from: w.status, to: b.status } : reply ? { kind: 'reply' } : (['title', 'description', 'area'] as const).some((k) => k in b && ((b as any)[k] ?? null) !== ((w as any)[k] ?? null)) ? { kind: 'edited' } : null;   /* only when something really changed */
    const mail = action ? await mailWishAuthor({ title: b.title ?? w.title, status: b.status ?? w.status, admin_note: 'admin_note' in b ? b.admin_note ?? null : w.admin_note, author_id: w.author_id }, action, who) : 'skipped';
    return ok({ notified: mail });
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
    return ok({ notified: await mailWishAuthor(w, { kind: 'deleted' }, { id: me.id, name: me.full_name || me.email }) });
  });
}
