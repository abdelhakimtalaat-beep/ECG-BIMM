import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = z.object({ name: z.string().trim().min(2).max(80) }).parse(await json(req));
    const s = await one<{ name: string }>('select name from course_sections where id=$1', [id]);
    if (!s) throw new ApiError(404, 'Section not found');
    if (await one('select 1 from course_sections where lower(name)=lower($1) and id<>$2', [b.name, id])) throw new ApiError(409, 'A section with this name already exists');
    await q('update course_sections set name=$1 where id=$2', [b.name, id]);
    await audit(null, me.email, 'update', 'course_section', id, `Renamed course section "${s.name}" → "${b.name}"`);
    return ok();
  });
}
/** A section can only be removed when it has no courses. */
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const s = await one<{ name: string }>('select name from course_sections where id=$1', [id]);
    if (!s) throw new ApiError(404, 'Section not found');
    const n = await one<{ n: number }>('select count(*)::int n from courses where section_id=$1', [id]);
    if (n!.n) throw new ApiError(409, `The section has ${n!.n} course(s). Move or delete them first`);
    await q('delete from course_sections where id=$1', [id]);
    await audit(null, me.email, 'delete', 'course_section', id, `Deleted course section "${s.name}"`);
    return ok();
  });
}
