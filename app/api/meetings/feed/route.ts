import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { readFeed, saveRows } from '@/lib/calendarSync';
import { cleanFeedUrl } from '@/lib/calendarUrl';

export const maxDuration = 30;
const who = (me: any, employee_id?: string) => {
  const id = employee_id ?? me.employee_id; if (!id) throw new ApiError(400, 'Your account is not linked to an employee record. Ask the Administrator to link it.');
  if (id !== me.employee_id && me.role !== 'admin') throw new ApiError(403, 'You can only manage your own calendar link.');
  return id as string;
};
/** Save (and immediately sync) the ICS link of a calendar. The owner or the Administrator. The link itself is never sent back to the browser. */
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ employee_id: z.string().uuid().optional(), url: z.string().trim().min(8).max(2000), share: z.enum(['everyone', 'managers']) }).parse(await json(req));
    const id = who(me, b.employee_id); const url = cleanFeedUrl(b.url);
    const e = await one<any>('select name from employees where id=$1', [id]); if (!e) throw new ApiError(404, 'Employee not found');
    let rows; try { rows = await readFeed(url); } catch (err: any) { throw new ApiError(400, err?.message ?? 'Could not read the calendar'); }
    await q(`insert into calendar_feeds(employee_id,url,share,created_by) values($1,$2,$3,$4) on conflict (employee_id) do update set url=excluded.url, share=excluded.share, updated_at=now()`, [id, url, b.share, me.email]);
    await saveRows(id, rows); const count = rows.length;
    await audit(null, me.email, 'update', 'calendar_feed', id, `${e.name}: calendar linked (${count} meetings read), shown to ${b.share === 'everyone' ? 'everyone' : 'managers only'}`);
    return ok({ count });
  });
}
export async function DELETE(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const id = who(me, new URL(req.url).searchParams.get('employee_id') ?? undefined);
    await q('delete from calendar_events where employee_id=$1', [id]); await q('delete from calendar_feeds where employee_id=$1', [id]);
    await audit(null, me.email, 'delete', 'calendar_feed', id, 'Calendar link removed');
    return ok();
  });
}
