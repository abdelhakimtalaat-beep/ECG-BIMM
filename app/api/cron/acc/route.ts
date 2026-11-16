import { handle, ok } from '@/lib/api';
import { ApiError } from '@/lib/auth';
import { syncNow } from '@/lib/accApi';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Called daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"; without that secret nothing runs. */
export async function GET(req: Request) {
  return handle(async () => {
    const s = process.env.CRON_SECRET;
    if (!s || req.headers.get('authorization') !== `Bearer ${s}`) throw new ApiError(401, 'Not allowed');
    const c = await one<{ refresh_token: string | null }>('select refresh_token from acc_connection where id=1');
    if (!c?.refresh_token) return ok({ status: 'skipped', message: 'ACC is not connected' });
    return ok(await syncNow());
  });
}
