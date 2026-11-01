import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';


const body = z.object({
  project_name: z.string().trim().min(1).max(200),
  proposal_number: z.string().trim().min(1).max(80),
  client: z.string().trim().max(200).nullish().transform((v) => v || null),
  proposal_manager: z.string().trim().max(120).nullish().transform((v) => v || null),
  expected_man_hours: z.number().min(0).max(100000000).nullish().transform((v) => v ?? null),
  calc: z.record(z.string(), z.any()).nullish().transform((v) => v ?? null),
});
export async function GET() {
  return handle(async () => {
    await requireUser();
    return ok({ proposals: await q('select id,project_name,proposal_number,client,proposal_manager,expected_man_hours::float8 as expected_man_hours,calc,created_by,created_at,updated_at from proposals order by created_at desc') });
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = body.parse(await json(req));
    if (await one('select 1 x from proposals where lower(proposal_number)=lower($1)', [b.proposal_number])) throw new ApiError(409, 'A proposal with this number already exists');
    const r = await one<{ id: string }>('insert into proposals(project_name,proposal_number,client,proposal_manager,expected_man_hours,calc,created_by) values($1,$2,$3,$4,$5,$6,$7) returning id',
      [b.project_name, b.proposal_number, b.client, b.proposal_manager, b.expected_man_hours, b.calc ? JSON.stringify(b.calc) : null, me.email]);
    await audit(null, me.email, 'create', 'proposal', r!.id, `Proposal ${b.proposal_number} added: ${b.project_name}`);
    return ok({ id: r!.id }, 201);
  });
}
