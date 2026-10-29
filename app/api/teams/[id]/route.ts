import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = z.object({ name: z.string().trim().min(1).max(80), member_ids: z.array(z.string().uuid()).max(100) }).parse(await json(req));
    await tx(async (c) => {
      if (!(await c.query('select 1 from teams where id=$1', [id])).rowCount) throw new ApiError(404, 'Team not found');
      if ((await c.query('select 1 from teams where lower(name)=lower($1) and id<>$2', [b.name, id])).rowCount) throw new ApiError(409, 'A team with this name already exists');
      await c.query('update teams set name=$1 where id=$2', [b.name, id]);
      await c.query('delete from team_members where team_id=$1', [id]);
      for (const e of new Set(b.member_ids)) await c.query('insert into team_members(team_id,employee_id) values($1,$2)', [id, e]);
      await audit(c, me.email, 'update', 'team', id, `Updated team ${b.name} (${new Set(b.member_ids).size} members)`);
    });
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    await tx(async (c) => {
      const t = await c.query('select name,(select count(*) from tasks k join task_areas a on a.id=k.area_id where a.team_id=teams.id)::int n from teams where id=$1', [id]);
      if (!t.rowCount) throw new ApiError(404, 'Team not found');
      await c.query('delete from teams where id=$1', [id]);
      await audit(c, me.email, 'delete', 'team', id, `Deleted team ${t.rows[0].name} (${t.rows[0].n} tasks)`);
    });
    return ok();
  });
}
