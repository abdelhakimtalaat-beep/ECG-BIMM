import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';

export const dynamic = 'force-dynamic';
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    return ok({ contents: await q('select id,name,kind,created_by,created_at from project_contents where project_id=$1 order by lower(name)', [id]) });
  });
}
/** Project contents (buildings, infrastructure...) are added by the Administrator or the BIM Manager / BIM Coordinator assigned to the project. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; z.string().uuid().parse(id);
    await assertScope(me, id, 'manager');
    const b = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(['Building', 'Infrastructure', 'Landscape', 'Other']) }).parse(await json(req));
    const p = await one<any>('select name from projects where id=$1', [id]); if (!p) throw new ApiError(404, 'Project not found');
    if (await one('select 1 x from project_contents where project_id=$1 and lower(name)=lower($2)', [id, b.name])) throw new ApiError(409, 'This project already has an item with that name');
    const r = await one<{ id: string }>('insert into project_contents(project_id,name,kind,created_by) values($1,$2,$3,$4) returning id', [id, b.name, b.kind, me.email]);
    await audit(null, me.email, 'create', 'project_content', r!.id, `${p.name}: content added — ${b.kind} ${b.name}`);
    return ok({ id: r!.id }, 201);
  });
}
