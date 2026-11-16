import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { apsConfigured } from '@/lib/accApi';
import { q, one } from '@/lib/db';

export const dynamic = 'force-dynamic';
/** Administrator: state of the ACC connection and the ACC projects found in the last extract. */
export async function GET() {
  return handle(async () => {
    await requireUser(['admin']);
    const c = await one<any>('select account_id,hub_name,connected_by,connected_at,request_id,last_job_id,last_sync_at,last_status,last_error, refresh_token is not null as has_token from acc_connection where id=1');
    const projects = await q<any>(`select s.acc_project_id,s.name,s.synced_at,(select p.id from projects p where p.acc_project_id=s.acc_project_id limit 1) as portal_project_id from acc_project_stats s order by lower(s.name)`);
    return ok({ configured: apsConfigured(), connected: !!c?.has_token, connection: c ? { ...c, refresh_token: undefined } : null, projects });
  });
}
