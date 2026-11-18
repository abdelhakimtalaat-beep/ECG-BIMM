import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, pickerProjects } from '@/lib/accApi';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Administrator: every ACC project the connected account can see, to choose which ones to track. */
export async function GET() {
  return handle(async () => {
    await requireUser(['admin']); const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1'); if (!c) return ok({ projects: [] });
    return ok({ projects: await pickerProjects(await accessToken(), c.account_id) });
  });
}
