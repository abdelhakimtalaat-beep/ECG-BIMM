import { handle, ok } from '@/lib/api';
import { requireTab } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';
/** ACC Statistics tab: for every portal project linked to an ACC project, the issues by assignee (role or person) and status. */
export async function GET() {
  return handle(async () => {
    await requireTab('/acc-stats');
    const rows = await q<any>(`select p.id,p.name,p.project_no,s.acc_project_id,s.synced_at,s.stats->'assignees' as assignees,s.stats->'locations' as locations,s.stats->'matrix' as matrix,(s.stats->'issues'->>'total')::int as total from projects p join acc_project_stats s on s.acc_project_id=p.acc_project_id order by p.project_no nulls last, lower(p.name)`);
    return ok({ projects: rows });
  });
}
