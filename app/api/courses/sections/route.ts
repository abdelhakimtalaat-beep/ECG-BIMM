import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one } from '@/lib/db';

/** Adds a section (Revit, Civil 3D, …) to Internal Courses. Administrator only. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = z.object({ name: z.string().trim().min(2).max(80) }).parse(await json(req));
    if (await one('select 1 from course_sections where lower(name)=lower($1)', [b.name])) throw new ApiError(409, 'A section with this name already exists');
    const r = await one<{ id: string }>('insert into course_sections(name,position) values($1,(select coalesce(max(position),0)+1 from course_sections)) returning id', [b.name]);
    await audit(null, me.email, 'create', 'course_section', r!.id, `Added course section "${b.name}"`);
    return ok({ id: r!.id }, 201);
  });
}
