import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, requestNow, syncNow } from '@/lib/accApi';
import { audit, one } from '@/lib/db';

export const maxDuration = 60;
/** Administrator: import the newest extract now; with request_now Autodesk is also asked to prepare a fresh extract. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']); let reqNote = ''; const b = z.object({ request_now: z.boolean().optional() }).parse(await json(req).catch(() => ({})));
    if (b.request_now) { const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1'); if (c) { const rn = await requestNow(await accessToken(), c.account_id); reqNote = rn.error ? `Autodesk refused the fresh extract (${rn.n} accepted): ${rn.error}. ` : `${rn.n} fresh extract(s) requested. `; } }   // one-time extracts of the set-up projects
    const r = await syncNow(); await audit(null, me.email, 'update', 'acc', null, `ACC sync: ${r.status}`);
    return ok(b.request_now && r.status !== 'imported' ? { ...r, message: reqNote + 'It usually takes some minutes; press "Import now" again later. ' + r.message } : r);
  });
}
