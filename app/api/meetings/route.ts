import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { refreshStale } from '@/lib/calendarSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
/** Meetings of all connected engineers in a date range. Titles are shown in full to the owner, the Administrator and BIM Managers; to everyone only when the owner chose "Everyone". */
export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const sp = new URL(req.url).searchParams;
    const from = z.string().datetime({ offset: true }).parse(sp.get('from')), to = z.string().datetime({ offset: true }).parse(sp.get('to'));
    try { await refreshStale(); } catch {}
    const feeds = await q<any>('select employee_id,share,last_synced_at,last_error,event_count, true as has_link from calendar_feeds');
    const shareOf = new Map(feeds.map((f: any) => [f.employee_id, f.share]));
    const rows = await q<any>('select id,employee_id,uid,start_at,end_at,all_day,title,location,organizer,teams_url,is_private,busy from calendar_events where end_at>$1 and start_at<$2 order by start_at limit 3000', [from, to]);
    const privileged = me.role === 'admin' || me.role === 'bim_manager';
    const events = rows.map((r: any) => {
      const own = !!me.employee_id && r.employee_id === me.employee_id;
      const full = own || (privileged && !r.is_private) || (shareOf.get(r.employee_id) === 'everyone' && !r.is_private);
      return full ? { ...r, masked: false } : { id: r.id, employee_id: r.employee_id, uid: r.uid, start_at: r.start_at, end_at: r.end_at, all_day: r.all_day, title: r.is_private ? 'Private appointment' : 'Busy', location: null, organizer: null, teams_url: null, is_private: r.is_private, busy: r.busy, masked: true };
    });
    return ok({ events, feeds, my_employee_id: me.employee_id });
  });
}
