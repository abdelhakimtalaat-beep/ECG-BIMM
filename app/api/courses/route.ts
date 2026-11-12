import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireTab, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { courseBody } from '@/lib/courses';

export const dynamic = 'force-dynamic';
/** Everyone who may see the tab reads the courses with their sessions. */
export async function GET() {
  return handle(async () => {
    await requireTab('/courses');
    const courses = await q<any>('select id,title,instructor,description,video_url,server_path,created_at,updated_at from courses order by lower(title)');
    const sessions = await q<any>('select id,course_id,title,video_url from course_sessions order by course_id,position');
    return ok({ courses: courses.map((c) => ({ ...c, sessions: sessions.filter((s) => s.course_id === c.id).map(({ id, title, video_url }) => ({ id, title, video_url })) })) });
  });
}
/** Only the Administrator adds courses. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = courseBody.parse(await json(req));
    const r = await one<{ id: string }>('insert into courses(title,instructor,description,video_url,server_path,created_by) values($1,$2,$3,$4,$5,$6) returning id', [b.title, b.instructor, b.description, b.video_url, b.server_path, me.email]);
    for (const [i, s] of b.sessions.entries()) await q('insert into course_sessions(course_id,position,title,video_url) values($1,$2,$3,$4)', [r!.id, i, s.title, s.video_url]);
    await audit(null, me.email, 'create', 'course', r!.id, `Added course "${b.title}" with ${b.sessions.length} sessions`);
    return ok({ id: r!.id }, 201);
  });
}
