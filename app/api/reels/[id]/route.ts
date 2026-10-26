import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { weekdayOf } from '@/lib/metrics';
import { canChangeReelStatus, canEditReel } from '@/lib/rules';
import { reelCancel, reelInvite, safe } from '@/lib/notify';

const patch = z.object({
  employee_id: z.string().uuid().nullable(), presenter_code: z.string().trim().max(40).nullable(), presenter_name: z.string().trim().min(1).max(120),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weekday: z.string(), topic: z.string().trim().max(300).nullable(), software: z.enum(['Revit', 'Navisworks', 'ACC', 'Dynamo']).nullable(),
  status: z.enum(['Not recorded', 'Planned', 'Completed', 'Postponed', 'Cancelled']), notes: z.string().max(4000).nullable(),
  link: z.string().trim().max(500).nullable().refine((v) => !v || /^https?:\/\//i.test(v), 'Link must start with http:// or https://'),
}).partial();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager', 'bim_coordinator']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = patch.parse(await json(req));
    const cur = await one<any>('select session_date::text d, weekday, presenter_name, status, employee_id, topic, software, link from reel_sessions where id=$1', [id]);
    if (!cur) throw new ApiError(404, 'Session not found');
    if (!canEditReel(me.role, cur.status)) throw new ApiError(403, 'Only the Administrator can edit a reel that is not Planned');
    if (b.status !== undefined && b.status !== cur.status && !canChangeReelStatus(me.role)) throw new ApiError(403, 'Only the Administrator can change a reel status');
    const date = b.session_date ?? cur.d;
    const wd = weekdayOf(date);
    if (b.weekday && b.weekday !== wd) throw new ApiError(400, `${date} is a ${wd}, not ${b.weekday}`);
    const { weekday, ...cols } = b as any;
    const keys = Object.keys(cols);
    const vals = keys.map((k) => cols[k]);
    const sets = keys.map((k, i) => `${k}=$${i + 1}`);
    sets.push(`weekday=$${vals.length + 1}`); vals.push(wd); vals.push(id);
    await q(`update reel_sessions set ${sets.join(',')}, updated_at=now() where id=$${vals.length}`, vals);
    await audit(null, me.email, 'update', 'reel', id, `Edited BIM Reel ${date} – ${b.presenter_name ?? cur.presenter_name}`, cur, cols);
    const now = (await one<any>('select employee_id, session_date::text session_date, topic, software, link, status, presenter_name from reel_sessions where id=$1', [id]))!;
    const mail = await safe(async () => {
      let sent = false;
      if (cur.employee_id && cur.employee_id !== now.employee_id) sent = await reelCancel({ id, employee_id: cur.employee_id, session_date: cur.d, topic: cur.topic, software: cur.software, link: cur.link, status: 'Cancelled', presenter_name: cur.presenter_name });
      return (await reelInvite({ id, ...now })) || sent;
    });
    return ok({ mail });
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const cur = await one<any>('select session_date::text d, presenter_name, employee_id, topic, software, link from reel_sessions where id=$1', [id]);
    if (!cur) throw new ApiError(404, 'Session not found');
    await q('delete from reel_sessions where id=$1', [id]);
    await audit(null, me.email, 'delete', 'reel', id, `Deleted BIM Reel ${cur.d} – ${cur.presenter_name}`);
    const mail = await safe(() => reelCancel({ id, employee_id: cur.employee_id, session_date: cur.d, topic: cur.topic, software: cur.software, link: cur.link, status: 'Cancelled', presenter_name: cur.presenter_name }));
    return ok({ mail });
  });
}
