import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { canChangeTemplate } from '@/lib/emailTemplates';

const patch = z.object({
  title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000),
  status: z.enum(['approved', 'pending', 'rejected']), review_note: z.string().trim().max(1000).nullable(),
}).partial();
const load = async (id: string) => { const t = await one<any>('select id,title,status,requested_by from email_templates where id=$1', [id]); if (!t) throw new ApiError(404, 'Template not found'); return t; };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = patch.parse(await json(req));
    const t = await load(id);
    const keys = Object.keys(b);
    if (!keys.length) throw new ApiError(400, 'Nothing to update');
    if (keys.some((k) => k === 'status' || k === 'review_note') && me.role !== 'admin') throw new ApiError(403, 'Only the Administrator can approve or reject a template');
    if (!canChangeTemplate(t, me.role, me.email)) throw new ApiError(403, 'You can only edit your own request until it is approved');
    const vals = keys.map((k) => (b as any)[k] ?? null);
    await q(`update email_templates set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}, updated_at=now() where id=$${vals.length + 1}`, [...vals, id]);
    await audit(null, me.email, b.status && b.status !== t.status ? 'status' : 'update', 'email_template', id, b.status && b.status !== t.status ? `Email template "${t.title}": ${t.status} → ${b.status}` : `Edited email template "${t.title}"`);
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const t = await load(id);
    if (!canChangeTemplate(t, me.role, me.email)) throw new ApiError(403, 'You can only withdraw your own request');
    await q('delete from email_templates where id=$1', [id]);
    await audit(null, me.email, 'delete', 'email_template', id, `Deleted email template "${t.title}"`);
    return ok();
  });
}
