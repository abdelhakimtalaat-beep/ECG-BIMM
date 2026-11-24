import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q, tx } from '@/lib/db';
import { mailAdmins, mailTicket } from '@/lib/ticketMail';
import { actorOf } from '@/lib/ticketAccess';
import { isAdmin, isReviewer, validateNew } from '@/lib/tickets';

export const dynamic = 'force-dynamic';
const body = z.object({ project_id: z.string().uuid(), ticket_type: z.string(), software: z.string(), title: z.string(), problem: z.string(), priority: z.string(), extension: z.string(), mobile: z.string().nullish(), image_id: z.string().uuid().nullish() });

/** The queries the person may see: the Administrator sees all; everybody else the ones he sent or that were transferred to him. */
export async function GET() {
  return handle(async () => {
    const me0 = await requireTab('/troubleshooting'); const me = await actorOf(me0);
    const rows = await q(`select t.id, t.ticket_no, t.ticket_type, t.project_id, t.project_name, t.software, t.title, t.priority, t.status, t.requester_id, t.requester_name, t.assignee_id, t.assignee_name, t.created_at, t.updated_at, t.resolved_at
      from tickets t ${isReviewer(me) ? '' : 'where t.requester_id=$1 or t.assignee_id=$1'} order by (t.status='Resolved'), t.created_at desc`, isReviewer(me) ? [] : [me.id]);
    const engineers = isAdmin(me) ? await q(`select id, coalesce(full_name, email) as name, role from users where active and role in ('bim_manager','bim_coordinator','bim_specialist') order by lower(coalesce(full_name, email))`) : [];
    return ok({ tickets: rows, engineers, reviewer: isReviewer(me), admin: isAdmin(me) });
  });
}
/** Any signed-in user sends a query. Everything is mandatory except the mobile number and the image. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireTab('/troubleshooting'); const b = body.parse(await json(req));
    const bad = validateNew(b); if (bad) throw new ApiError(400, bad);
    const p = await one<{ name: string; project_no: string | null }>('select name, project_no from projects where id=$1', [b.project_id]); if (!p) throw new ApiError(404, 'Project not found');
    if (b.image_id && !(await one(`select 1 x from attachments where id=$1 and kind='ticket_image' and created_by=$2`, [b.image_id, me.email]))) throw new ApiError(400, 'The image was not found. Attach it again');
    const who = me.full_name || me.email; const projectName = `${p.project_no ? p.project_no + ' · ' : ''}${p.name}`;
    const t = await tx(async (c) => {
      const r = (await c.query(`insert into tickets(project_id,project_name,ticket_type,software,title,problem,priority,extension,mobile,image_id,requester_id,requester_name,requester_email) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id,ticket_no`,
        [b.project_id, projectName, b.ticket_type.trim(), b.software.trim(), b.title.trim(), b.problem.trim(), b.priority.trim(), b.extension.trim(), b.mobile?.trim() || null, b.image_id ?? null, me.id, who, me.email])).rows[0];
      await c.query(`insert into ticket_events(ticket_id,by_name,action,note) values($1,$2,'Submitted',null)`, [r.id, who]);
      await audit(c, me.email, 'create', 'ticket', r.id, `BIM ticket TS-${String(r.ticket_no).padStart(4, '0')}: ${b.title.trim()}`);
      return r as { id: string; ticket_no: number };
    });
    const row = { ticket_no: t.ticket_no, ticket_type: b.ticket_type.trim(), title: b.title.trim(), project_name: projectName, software: b.software.trim(), priority: b.priority.trim(), problem: b.problem.trim() };
    const admins = await mailAdmins(row, { kind: 'new', by: who }, me.id);   /* the Administrators are told; the sender gets a receipt */
    const receipt = await mailTicket({ email: me.email, name: who }, row, { kind: 'received' });
    return ok({ id: t.id, ticket_no: t.ticket_no, mail: { admins, receipt } }, 201);
  });
}
