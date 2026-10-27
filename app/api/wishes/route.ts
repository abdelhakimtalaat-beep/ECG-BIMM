import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { WISH_AREAS } from '@/lib/wishes';

export async function GET() {
  return handle(async () => {
    const me = await requireUser();
    const rows = await q(`select w.id,w.title,w.description,w.area,w.author_name,w.status,w.admin_note,w.created_at,w.updated_at,
        (select count(*) from wish_votes v where v.wish_id=w.id)::int as votes,
        exists(select 1 from wish_votes v where v.wish_id=w.id and v.user_id=$1) as voted,
        (w.author_id = $1) as mine
      from wishes w order by w.created_at desc`, [me.id]);
    return ok({ wishes: rows });
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).nullish().transform((v) => v || null), area: z.enum(WISH_AREAS).nullish().transform((v) => v ?? null) }).parse(await json(req));
    const r = await one<{ id: string }>('insert into wishes(title,description,area,author_id,author_name) values($1,$2,$3,$4,$5) returning id', [b.title, b.description, b.area, me.id, me.full_name || me.email]);
    await audit(null, me.email, 'create', 'wish', r!.id, `Wish proposed: ${b.title}`);
    return ok({ id: r!.id }, 201);
  });
}
