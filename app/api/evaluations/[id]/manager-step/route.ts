import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, tx } from '@/lib/db';
import { actorsOf, detail, loadEv } from '@/lib/evaluationServer';

/** Administrator: remove (or bring back) the direct-manager step of one employee's evaluation. A form that is waiting on the manager moves on to the department manager. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); if (me.role !== 'admin') throw new ApiError(403, 'Only the Administrator can remove the direct manager step');
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const { skip } = z.object({ skip: z.boolean() }).parse(await json(req)); const ev = await loadEv(id);
    await tx(async (c) => {
      const info = { ...(ev.info ?? {}) }; if (skip) info.skip_manager = true; else delete info.skip_manager;
      const moveOn = skip && ev.status === 'manager';
      await c.query(`update evaluations set info=$2, status=$3, updated_at=now() where id=$1`, [id, JSON.stringify(info), moveOn ? 'department' : ev.status]);
      await audit(c, me.email, 'update', 'evaluation', id, `Evaluation ${ev.period}: direct manager step ${skip ? 'removed' : 'restored'}${moveOn ? '; the form moved on to the department manager' : ''}`);
    });
    const fresh = await loadEv(id); return ok(await detail(me, fresh, await actorsOf(fresh)));
  });
}
