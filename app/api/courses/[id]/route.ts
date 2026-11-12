import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { courseBody } from '@/lib/courses';

/** Edit a course and replace its list of sessions. Administrator only. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = courseBody.parse(await json(req));
    const c = await one<{ title: string }>('select title from courses where id=$1', [id]);
    if (!c) throw new ApiError(404, 'Course not found');
    await q('update courses set title=$1,instructor=$2,description=$3,video_url=$4,server_path=$5,updated_at=now() where id=$6', [b.title, b.instructor, b.description, b.video_url, b.server_path, id]);
    await q('delete from course_sessions where course_id=$1', [id]);
    for (const [i, s] of b.sessions.entries()) await q('insert into course_sessions(course_id,position,title,video_url) values($1,$2,$3,$4)', [id, i, s.title, s.video_url]);
    await audit(null, me.email, 'update', 'course', id, `Edited course "${b.title}" (${b.sessions.length} sessions)`);
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const c = await one<{ title: string }>('select title from courses where id=$1', [id]);
    if (!c) throw new ApiError(404, 'Course not found');
    await q('delete from courses where id=$1', [id]);
    await audit(null, me.email, 'delete', 'course', id, `Deleted course "${c.title}"`);
    return ok();
  });
}
