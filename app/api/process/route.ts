import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';
/** The process dashboard of one project: its contents, the buildings added to the map, and the status of every node. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const id = z.string().uuid().parse(new URL(req.url).searchParams.get('project_id'));
    const contents = await q('select id,name,kind from project_contents where project_id=$1 order by lower(name)', [id]);
    const buildings = await q('select b.id,b.content_id,c.name,c.kind from process_buildings b join project_contents c on c.id=b.content_id where b.project_id=$1 order by lower(c.name)', [id]);
    const nodes = await q(`select n.building_id,n.node_key,n.status,n.comment,n.updated_by,n.updated_at from process_nodes n join process_buildings b on b.id=n.building_id where b.project_id=$1`, [id]);
    const linked = (await q<{ node_key: string }>('select node_key from process_project_nodes where project_id=$1', [id])).map((r) => r.node_key);
    return ok({ contents, buildings, nodes, linked });
  });
}
