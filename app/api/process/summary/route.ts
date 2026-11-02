import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { NODES } from '@/lib/processMap';

export const dynamic = 'force-dynamic';
/** One line per project that has buildings on the map: how many, and how many nodes are in each status. */
export async function GET() {
  return handle(async () => {
    await requireUser();
    const rows = await q(`select b.project_id,count(distinct b.id)::int buildings,
        count(n.*) filter (where n.status='Completed')::int done, count(n.*) filter (where n.status='In Progress')::int doing, count(n.*) filter (where n.status='On Hold')::int hold
      from process_buildings b left join process_nodes n on n.building_id=b.id group by b.project_id`);
    return ok({ nodes_per_building: NODES.length, projects: rows });
  });
}
