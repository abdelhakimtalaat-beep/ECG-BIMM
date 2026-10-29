import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, tx } from '@/lib/db';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = z.object({ name: z.string().trim().min(1).max(80), member_ids: z.array(z.string().uuid()).max(100) }).parse(await json(req));
    const id = await tx(async (c) => {
      if ((await c.query('select 1 from teams where lower(name)=lower($1)', [b.name])).rowCount) throw new ApiError(409, 'A team with this name already exists');
      const r = await c.query('insert into teams(name,created_by) values($1,$2) returning id', [b.name, me.email]);
      for (const e of new Set(b.member_ids)) await c.query('insert into team_members(team_id,employee_id) values($1,$2)', [r.rows[0].id, e]);
      await audit(c, me.email, 'create', 'team', r.rows[0].id, `Added team ${b.name} (${new Set(b.member_ids).size} members)`);
      return r.rows[0].id;
    });
    return ok({ id }, 201);
  });
}
