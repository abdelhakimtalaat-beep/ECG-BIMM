import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, setupRequests } from '@/lib/accApi';
import { audit, one } from '@/lib/db';

export const maxDuration = 60;
/** Administrator: (re)create the daily extract request of every ACC project that matches a portal project number. */
export async function POST() {
  return handle(async () => {
    const me = await requireUser(['admin']); const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1');
    if (!c) return ok({ created: 0, skipped: [], message: 'ACC is not connected yet' });
    const r = await setupRequests(await accessToken(), c.account_id); await audit(null, me.email, 'update', 'acc', null, `ACC set-up: ${r.message.slice(0, 200)}`); return ok(r);
  });
}
