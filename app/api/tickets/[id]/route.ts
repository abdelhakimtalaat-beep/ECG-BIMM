import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q, tx } from '@/lib/db';
import { adminsOf, loadImage, mailAdmins, mailReviewers, mailTicket } from '@/lib/ticketMail';
import { orgPeople, routeRecipients } from '@/lib/ticketRouting';
import { actorOf } from '@/lib/ticketAccess';
import { canAnswer, canAssign, canReopen, canResolve, canReturn, canView, isAdmin, showDraft } from '@/lib/tickets';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const load = async (id: string, uid: string) => { const t = await one<any>('select t.*, exists (select 1 from ticket_recipients r where r.ticket_id=t.id and r.user_id=$2) as recipient from tickets t where t.id=$1', [id, uid]); if (!t) throw new ApiError(404, 'Query not found'); return t; };
const act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('assign'), assignee_id: uuid, note: z.string().trim().max(2000).nullish() }),
  z.object({ action: z.literal('answer'), text: z.string().trim().min(3, 'Write the answer').max(8000), image_id: uuid.nullish() }),
  z.object({ action: z.literal('return'), note: z.string().trim().min(3, 'Write what needs to change').max(2000) }),
  z.object({ action: z.literal('resolve'), text: z.string().trim().min(3, 'Write the answer').max(8000), image_id: uuid.nullish() }),
  z.object({ action: z.literal('reopen'), note: z.string().trim().min(3, 'Say why you are reopening it').max(2000) }),
]);
/** An image may be attached when it was uploaded by the person, or already belongs to this query. */
async function okImage(imageId: string | null | undefined, t: any, email: string) {
  if (!imageId) return null; if ([t.image_id, t.draft_image_id, t.final_image_id].includes(imageId)) return imageId;
  if (!(await one(`select 1 x from attachments where id=$1 and kind='ticket_image' and created_by=$2`, [imageId, email]))) throw new ApiError(400, 'The image was not found. Attach it again'); return imageId;
}
const mailRow = (t: any, over: any = {}) => ({ ticket_no: t.ticket_no, ticket_type: t.ticket_type, title: t.title, project_name: t.project_name, software: t.software, priority: t.priority, problem: t.problem, ...over });

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await actorOf(await requireTab('/troubleshooting')); const id = uuid.parse((await ctx.params).id); const t = await load(id, me.id);
    if (!canView(me, t)) throw new ApiError(403, 'You cannot open this query');
    const draft = showDraft(me, t); const events = await q(`select at, by_name, action, note from ticket_events where ticket_id=$1 ${draft ? '' : 'and not internal'} order by at`, [id]);
    const { draft_answer, draft_image_id, draft_by, draft_at, recipient, ...pub } = t; const people = canAssign(me, t) ? await orgPeople(me.id) : [];
    return ok({ ticket: { ...pub, recipient, requester_email: isAdmin(me) || me.reviewer || t.requester_id === me.id ? t.requester_email : null, ...(draft ? { draft_answer, draft_image_id, draft_by, draft_at } : {}), final_answer: t.status === 'Resolved' || draft ? t.final_answer : null }, events, people });
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me0 = await requireTab('/troubleshooting'); const me = await actorOf(me0); const id = uuid.parse((await ctx.params).id); const b = act.parse(await json(req)); const t = await load(id, me.id);
    if (!canView(me, t)) throw new ApiError(403, 'You cannot open this query'); const who = me0.full_name || me0.email;
    const ev = (c: any, action: string, note: string | null, internal: boolean) => c.query('insert into ticket_events(ticket_id,by_name,action,note,internal) values($1,$2,$3,$4,$5)', [id, who, action, note, internal]);
    let mail: string = 'skipped';
    if (b.action === 'assign') {
      if (!canAssign(me, t)) throw new ApiError(403, 'You cannot hand over this ticket now');
      const e = await one<{ id: string; email: string; name: string }>(`select u.id,u.email,coalesce(e.name,u.full_name,u.email) as name from users u left join employees e on lower(e.email)=lower(u.email) where u.id=$1 and u.active`, [b.assignee_id]);
      if (!e) throw new ApiError(400, 'Choose a person from the org chart who has a portal account');
      if (e.id === t.requester_id) throw new ApiError(400, 'You cannot hand the ticket to the person who sent it');
      await tx(async (c) => { await c.query(`update tickets set assignee_id=$2, assignee_name=$3, assigned_at=now(), status='Assigned', draft_answer=null, draft_image_id=null, draft_by=null, draft_at=null, updated_at=now() where id=$1`, [id, e.id, e.name]); await c.query(`insert into ticket_recipients(ticket_id,user_id) values($1,$2) on conflict do nothing`, [id, e.id]); await ev(c, `Handed over to ${e.name}`, b.note || null, false); await audit(c, me0.email, 'update', 'ticket', id, `Query TS-${t.ticket_no} handed over to ${e.name}`); });
      mail = await mailTicket({ email: e.email, name: e.name }, mailRow(t), { kind: 'assigned', by: who });
    } else if (b.action === 'answer') {
      if (!canAnswer(me, t)) throw new ApiError(403, 'You cannot answer this query now');
      const img = await okImage(b.image_id, t, me0.email);
      const takes = !t.assignee_id && !isAdmin(me);   /* the first engineer who solves it becomes the owner of the ticket */
      await tx(async (c) => { await c.query(`update tickets set draft_answer=$2, draft_image_id=$3, draft_by=$4, draft_at=now(), status='Answered', assignee_id=case when $5 then $6::uuid else assignee_id end, assignee_name=case when $5 then $4 else assignee_name end, updated_at=now() where id=$1`, [id, b.text, img, who, takes, me.id]); await ev(c, 'Final solution sent for review', null, true); await audit(c, me0.email, 'update', 'ticket', id, `Query TS-${t.ticket_no} answered (waiting for review)`); });
      mail = await mailReviewers(mailRow(t), { kind: 'review', by: who }, me.id);
    } else if (b.action === 'return') {
      if (!canReturn(me, t)) throw new ApiError(403, 'Only an answered query can be returned to the engineer');
      await tx(async (c) => { await c.query(`update tickets set status='Assigned', updated_at=now() where id=$1`, [id]); await ev(c, 'Returned to the engineer', b.note, true); await audit(c, me0.email, 'update', 'ticket', id, `Query TS-${t.ticket_no} returned to ${t.assignee_name}`); });
      const e = await one<{ email: string; name: string }>(`select email, coalesce(full_name,email) as name from users where id=$1`, [t.assignee_id]);
      mail = await mailTicket(e, mailRow(t), { kind: 'returned', by: who, note: b.note });
    } else if (b.action === 'resolve') {
      if (!canResolve(me, t)) throw new ApiError(403, 'Only the Administrator can confirm the answer');
      const img = await okImage(b.image_id, t, me0.email); const resolver: string = t.status === 'Answered' && t.draft_by ? t.draft_by : who;   /* the engineer who wrote it; the person who confirms is the reviewer */
      await tx(async (c) => { await c.query(`update tickets set final_answer=$2, final_image_id=$3, resolved_by=$4, final_by=$5, resolved_at=now(), status='Resolved', updated_at=now() where id=$1`, [id, b.text, img, who, resolver]); await ev(c, 'Solution sent to the requester', null, false); await audit(c, me0.email, 'update', 'ticket', id, `Query TS-${t.ticket_no} resolved and answer e-mailed to ${t.requester_email}`); });
      mail = await mailTicket({ email: t.requester_email, name: t.requester_name }, mailRow(t), { kind: 'resolved', answer: b.text, hasImage: !!img, resolvedBy: resolver, reviewedBy: who }, await loadImage(img));
    } else {
      if (!canReopen(me, t)) throw new ApiError(403, 'Only the requester or a reviewer can reopen a resolved ticket');
      const to = await routeRecipients(t.ticket_type, t.project_id, t.requester_id); const single = to.length === 1 ? to[0] : null;
      await tx(async (c) => { await c.query(`delete from ticket_recipients where ticket_id=$1`, [id]); for (const x of to) await c.query(`insert into ticket_recipients(ticket_id,user_id) values($1,$2) on conflict do nothing`, [id, x.id]);
        await c.query(`update tickets set status=$2, assignee_id=$3, assignee_name=$4, updated_at=now() where id=$1`, [id, to.length ? 'Assigned' : 'New', single?.id ?? null, single?.name ?? null]); await ev(c, 'Reopened', b.note, false); await audit(c, me0.email, 'update', 'ticket', id, `Query TS-${t.ticket_no} reopened`); });
      const adminIds = new Set((await adminsOf()).map((a) => a.id));
      await Promise.all(to.filter((x) => !adminIds.has(x.id) && x.id !== me.id).map((x) => mailTicket(x, mailRow(t), { kind: 'reopened', by: who, note: b.note })));
      mail = await mailAdmins(mailRow(t), { kind: 'reopened', by: who, note: b.note }, me.id);
    }
    return ok({ mail });
  });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/troubleshooting'); if (!isAdmin(me)) throw new ApiError(403, 'Only the Administrator can delete a query');
    const id = uuid.parse((await ctx.params).id); const t = await load(id, me.id);
    await tx(async (c) => { await c.query('delete from tickets where id=$1', [id]); await c.query(`delete from attachments where id = any($1::uuid[])`, [[t.image_id, t.draft_image_id, t.final_image_id].filter(Boolean)]); await audit(c, me.email, 'delete', 'ticket', id, `Query TS-${t.ticket_no} deleted`); });
    return ok();
  });
}
