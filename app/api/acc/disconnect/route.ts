import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';

/** Administrator: forget the stored Autodesk sign-in (the statistics already imported stay). */
export async function POST() {
  return handle(async () => {
    const me = await requireUser(['admin']);
    await q(`update acc_connection set refresh_token=null,last_status='disconnected' where id=1`);
    await audit(null, me.email, 'update', 'acc', null, 'ACC disconnected');
    return ok();
  });
}
