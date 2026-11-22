import { handle, ok } from '@/lib/api';
import { ApiError } from '@/lib/auth';
import { syncNow } from '@/lib/accApi';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/**
 * Called by Vercel Cron (vercel.json) at 05:00 and 06:00 UTC. The import runs once a day, at the first call at or after 08:00 Cairo time:
 * 06:00 UTC in winter (UTC+2), 05:00 UTC in summer (UTC+3). It detects every project with extraction data in ACC and imports the newest extract.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; without that secret nothing runs.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const s = process.env.CRON_SECRET;
    if (!s || req.headers.get('authorization') !== `Bearer ${s}`) throw new ApiError(401, 'Not allowed');
    const c = await one<{ refresh_token: string | null; last_auto_date: string | null }>('select refresh_token, last_auto_date from acc_connection where id=1');
    if (!c?.refresh_token) return ok({ status: 'skipped', message: 'ACC is not connected' });
    const now = new Date(); const date = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); const hour = Number(now.toLocaleString('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false }));
    if (hour < 8) return ok({ status: 'skipped', message: `It is ${hour}:00 in Cairo; the import runs from 08:00` });
    if (c.last_auto_date === date) return ok({ status: 'skipped', message: 'Already imported today' });
    const r = await syncNow({ detect: true });
    if (!r.more) await q('update acc_connection set last_auto_date=$1 where id=1', [date]);   /* an unfinished run is continued by the next call */
    return ok(r);
  });
}
