import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

const body = z.object({
  name: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).nullish().transform((v) => v || null),
  job_title: z.string().trim().max(120).nullish().transform((v) => v || null),
  email: z.string().trim().toLowerCase().max(200).email().nullish().or(z.literal('')).transform((v) => v || null),
  mobile: z.string().trim().max(40).nullish().transform((v) => v || null),
  ext: z.string().trim().max(40).nullish().transform((v) => v || null),
  notes: z.string().trim().max(2000).nullish().transform((v) => v || null),
});
const load = async (id: string, me: { email: string; role: string }) => {
  const c = await one<any>('select id,name,created_by from contacts where id=$1', [id]);
  if (!c) throw new ApiError(404, 'Contact not found');
  if (me.role !== 'admin' && c.created_by !== me.email) throw new ApiError(403, 'Only the person who added this contact or the Administrator can change it');
  return c;
};
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = body.parse(await json(req)); await load(id, me);
    await q('update contacts set name=$1,department=$2,job_title=$3,email=$4,mobile=$5,ext=$6,notes=$7,updated_at=now() where id=$8', [b.name, b.department, b.job_title, b.email, b.mobile, b.ext, b.notes, id]);
    await audit(null, me.email, 'update', 'contact', id, `Updated contact ${b.name}`);
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const c = await load(id, me);
    await q('delete from contacts where id=$1', [id]);
    await audit(null, me.email, 'delete', 'contact', id, `Deleted contact ${c.name}`);
    return ok();
  });
}
