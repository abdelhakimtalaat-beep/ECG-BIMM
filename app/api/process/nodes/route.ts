import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';
import { NODE_KEYS, PROCESS_STATUSES, nodeById } from '@/lib/processMap';

/** Sets the status (and an optional comment) of one node of one building. Administrator or the assigned BIM Manager / Coordinator. */
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ building_id: z.string().uuid(), node_key: z.string().refine((k) => NODE_KEYS.has(k), 'Unknown node'), status: z.enum(PROCESS_STATUSES), comment: z.string().trim().max(1000).nullish().transform((v) => v || null) }).parse(await json(req));
    const bl = await one<any>('select b.project_id,c.name,p.name pname from process_buildings b join project_contents c on c.id=b.content_id join projects p on p.id=b.project_id where b.id=$1', [b.building_id]);
    if (!bl) throw new ApiError(404, 'Building not found on the process map');
    await assertScope(me, bl.project_id, 'manager');
    const before = await one<any>('select status from process_nodes where building_id=$1 and node_key=$2', [b.building_id, b.node_key]);
    if (b.status === 'Not Started' && !b.comment) await q('delete from process_nodes where building_id=$1 and node_key=$2', [b.building_id, b.node_key]);
    else await q(`insert into process_nodes(building_id,node_key,status,comment,updated_by,updated_at) values($1,$2,$3,$4,$5,now())
      on conflict (building_id,node_key) do update set status=excluded.status, comment=excluded.comment, updated_by=excluded.updated_by, updated_at=now()`, [b.building_id, b.node_key, b.status, b.comment, me.full_name || me.email]);
    await audit(null, me.email, 'status', 'process_node', b.building_id, `${bl.pname} / ${bl.name}: "${nodeById.get(b.node_key)!.label}" ${before?.status ?? 'Not Started'} → ${b.status}`);
    return ok();
  });
}
