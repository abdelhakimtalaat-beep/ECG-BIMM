import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { STAGES, stageLabel } from '@/lib/evaluation';
import { loadEv } from '@/lib/evaluationServer';

/** Administrator: send the form back to an earlier part (its scores are kept; that part and the later ones need to be submitted again). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); if (me.role !== 'admin') throw new ApiError(403, 'Only the Administrator can reopen an evaluation');
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const { to } = z.object({ to: z.enum(['self', 'manager', 'department']) }).parse(await json(req)); const ev = await loadEv(id);
    const order = STAGES.map((s) => s.key); const later = order.slice(order.indexOf(to));
    await tx(async (c) => {
      await c.query('update evaluation_stages set submitted_at=null, submitted_by=null where evaluation_id=$1 and stage = any($2::text[])', [id, later]);
      await c.query('update evaluations set status=$2, updated_at=now() where id=$1', [id, to]);
      await audit(c, me.email, 'reopen', 'evaluation', id, `Evaluation ${ev.period} sent back to: ${stageLabel(to)}`);
    });
    return ok();
  });
}
