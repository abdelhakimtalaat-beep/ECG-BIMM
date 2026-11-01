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
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = body.parse(await json(req));
    if (!(await one('select 1 x from proposals where id=$1', [id]))) throw new ApiError(404, 'Proposal not found');
    if (await one('select 1 x from proposals where lower(proposal_number)=lower($1) and id<>$2', [b.proposal_number, id])) throw new ApiError(409, 'A proposal with this number already exists');
    await q('update proposals set project_name=$1,proposal_number=$2,client=$3,proposal_manager=$4,expected_man_hours=$5,calc=$6,updated_at=now() where id=$7',
      [b.project_name, b.proposal_number, b.client, b.proposal_manager, b.expected_man_hours, b.calc ? JSON.stringify(b.calc) : null, id]);
    await audit(null, me.email, 'update', 'proposal', id, `Proposal ${b.proposal_number} updated`);
    return ok();
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const p = await one<any>('select proposal_number,project_name from proposals where id=$1', [id]);
    if (!p) throw new ApiError(404, 'Proposal not found');
    await q('delete from proposals where id=$1', [id]);
    await audit(null, me.email, 'delete', 'proposal', id, `Proposal ${p.proposal_number} deleted: ${p.project_name}`);
    return ok();
  });
}
