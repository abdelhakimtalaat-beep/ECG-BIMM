import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, q, tx } from '@/lib/db';
import { ITEM_KEYS, SECTIONS, STAGES, canEditHr, canEditStage, cleanScore, nextStatus, stageLabel } from '@/lib/evaluation';
import { actorsFor, detail, loadEv, whoOf } from '@/lib/evaluationServer';

export const dynamic = 'force-dynamic';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); const { id } = await ctx.params; z.string().uuid().parse(id);
    const ev = await loadEv(id); return ok(await detail(me, ev, await actorsFor(ev.employee_id)));
  });
}

const str = (n: number) => z.string().trim().max(n);
const infoSchema = z.object({
  location: str(120), employment_date: str(20), department: str(120), section: str(120),
  vacation_days: z.number().min(0).max(400).nullable(), sick_days: z.number().min(0).max(400).nullable(), late_hours: z.number().min(0).max(2000).nullable(),
  education: z.array(z.object({ degree: str(60), major: str(80), university: str(80), year: str(10) })).max(4),
}).partial();
const HR = ['vacation_days', 'sick_days', 'late_hours'] as const;
const body = z.object({
  stage: z.enum(['self', 'manager', 'department']),
  scores: z.record(z.string(), z.object({ score: z.number().nullable().optional(), comment: z.string().max(1000).nullable().optional() })).optional(),
  overall_comment: z.string().max(4000).optional(), info: infoSchema.optional(), submit: z.boolean().optional(),
});

/** Saves the stage the form is waiting on (autosave), and optionally submits it so the next person can start. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = body.parse(await json(req)); const ev = await loadEv(id); const a = await actorsFor(ev.employee_id); const who = whoOf(me);
    const mayStage = canEditStage(who, a, ev.status, b.stage), mayHr = canEditHr(who, a, ev.status);
    if (!mayStage && !(b.info && mayHr && !b.scores && b.overall_comment === undefined && !b.submit)) throw new ApiError(403, ev.status === b.stage ? 'It is not your turn to fill this part' : `This part is not open (the form is at: ${stageLabel(ev.status)})`);
    const keys = new Set(ITEM_KEYS);
    for (const k of Object.keys(b.scores ?? {})) if (!keys.has(k)) throw new ApiError(400, `Unknown item ${k}`);
    await tx(async (c) => {
      if (b.info) {
        const cur = ev.info ?? {}; const next: any = { ...cur };
        for (const [k, v] of Object.entries(b.info)) { if ((HR as readonly string[]).includes(k) ? mayHr : mayStage) next[k] = v; }
        await c.query('update evaluations set info=$2, updated_at=now() where id=$1', [id, JSON.stringify(next)]);
      }
      if (mayStage) {
        for (const [k, v] of Object.entries(b.scores ?? {}) as [string, { score?: number | null; comment?: string | null }][]) {
          const score = cleanScore(v.score); const comment = (v.comment ?? '').trim() || null;
          if (score === null && !comment) await c.query('delete from evaluation_scores where evaluation_id=$1 and stage=$2 and item_key=$3', [id, b.stage, k]);
          else await c.query('insert into evaluation_scores(evaluation_id,stage,item_key,score,comment) values($1,$2,$3,$4,$5) on conflict (evaluation_id,stage,item_key) do update set score=excluded.score, comment=excluded.comment', [id, b.stage, k, score, comment]);
        }
        if (b.overall_comment !== undefined) await c.query('insert into evaluation_stages(evaluation_id,stage,overall_comment) values($1,$2,$3) on conflict (evaluation_id,stage) do update set overall_comment=excluded.overall_comment', [id, b.stage, b.overall_comment.trim() || null]);
        await c.query('update evaluations set updated_at=now() where id=$1', [id]);
      }
      if (b.submit && mayStage) {
        if (ev.status !== b.stage) throw new ApiError(400, 'Only the part the form is waiting on can be submitted');
        const have = await c.query<{ item_key: string }>('select item_key from evaluation_scores where evaluation_id=$1 and stage=$2 and score is not null', [id, b.stage]);
        const rated = new Set(have.rows.map((r) => r.item_key));
        const missing = SECTIONS.filter((s) => !s.extra).flatMap((s) => s.items).filter((i) => !rated.has(i.key)).length;
        if (missing) throw new ApiError(400, `${missing} item(s) in the main sections have no score yet. Score every item before submitting.`);
        await c.query('insert into evaluation_stages(evaluation_id,stage,submitted_at,submitted_by) values($1,$2,now(),$3) on conflict (evaluation_id,stage) do update set submitted_at=now(), submitted_by=excluded.submitted_by', [id, b.stage, me.email]);
        const to = nextStatus(ev.status, !!a.managerId);
        await c.query('update evaluations set status=$2, updated_at=now() where id=$1', [id, to]);
        await audit(c, me.email, 'submit', 'evaluation', id, `${STAGES.find((s) => s.key === b.stage)!.label} submitted for evaluation ${ev.period}; now: ${stageLabel(to)}`);
      }
    });
    return ok(await detail(me, await loadEv(id), a));
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/evaluation'); if (me.role !== 'admin') throw new ApiError(403, 'Only the Administrator can delete an evaluation');
    const { id } = await ctx.params; z.string().uuid().parse(id); const ev = await loadEv(id);
    await q('delete from evaluations where id=$1', [id]); await audit(null, me.email, 'delete', 'evaluation', id, `Deleted evaluation ${ev.period}`);
    return ok();
  });
}
