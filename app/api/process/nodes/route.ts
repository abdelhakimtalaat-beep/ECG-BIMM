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
    const b = z.object({ building_id: z.string().uuid(), node_key: z.string().refine((k) => NODE_KEYS.has(k), 'Unknown node'), status: z.enum(PROCESS_STATUSES), comment: z.string().trim().max(1000).nullish().transform((v) => v || null), outcome: z.enum(['yes', 'no']).nullish(), outcome_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(), apply_all: z.boolean().optional() }).parse(await json(req));
    const bl = await one<any>('select b.project_id,c.name,p.name pname from process_buildings b join project_contents c on c.id=b.content_id join projects p on p.id=b.project_id where b.id=$1', [b.building_id]);
    if (!bl) throw new ApiError(404, 'Building not found on the process map');
    await assertScope(me, bl.project_id, 'manager');
    const gate = nodeById.get(b.node_key)!.kind === 'decision' && b.status === 'Completed';
    const outcome = gate ? b.outcome ?? null : null; const outcomeDate = outcome ? b.outcome_date ?? null : null;
    const before = await one<any>('select status from process_nodes where building_id=$1 and node_key=$2', [b.building_id, b.node_key]);
    if (b.status === 'Not Started' && !b.comment) await q('delete from process_nodes where building_id=$1 and node_key=$2', [b.building_id, b.node_key]);
    else await q(`insert into process_nodes(building_id,node_key,status,comment,outcome,outcome_date,updated_by,updated_at) values($1,$2,$3,$4,$6,$7,$5,now())
      on conflict (building_id,node_key) do update set status=excluded.status, comment=excluded.comment, outcome=excluded.outcome, outcome_date=excluded.outcome_date, updated_by=excluded.updated_by, updated_at=now()`, [b.building_id, b.node_key, b.status, b.comment, me.full_name || me.email, outcome, outcomeDate]);
    if (b.apply_all) {
      // linked: every building of the project (also buildings added later) follows this activity's status; each keeps its own comment
      await q(`insert into process_nodes(building_id,node_key,status,comment,updated_by,updated_at) select id,$2,$3,null,$4,now() from process_buildings where project_id=$1 and id<>$5
        on conflict (building_id,node_key) do update set status=excluded.status, outcome=case when excluded.status='Completed' then process_nodes.outcome else null end, outcome_date=case when excluded.status='Completed' then process_nodes.outcome_date else null end, updated_by=excluded.updated_by, updated_at=now()`, [bl.project_id, b.node_key, b.status, me.full_name || me.email, b.building_id]);
      if (b.status === 'Not Started') await q(`delete from process_nodes where node_key=$2 and status='Not Started' and coalesce(comment,'')='' and building_id in (select id from process_buildings where project_id=$1)`, [bl.project_id, b.node_key]);
      await q(`insert into process_project_nodes(project_id,node_key,status,updated_by,updated_at) values($1,$2,$3,$4,now())
        on conflict (project_id,node_key) do update set status=excluded.status, updated_by=excluded.updated_by, updated_at=now()`, [bl.project_id, b.node_key, b.status, me.full_name || me.email]);
    } else if (b.apply_all === false) await q('delete from process_project_nodes where project_id=$1 and node_key=$2', [bl.project_id, b.node_key]); // unticked: unlinked, only this building changes
    await audit(null, me.email, 'status', 'process_node', b.building_id, `${bl.pname} / ${bl.name}: "${nodeById.get(b.node_key)!.label}" ${before?.status ?? 'Not Started'} → ${b.status}${outcome ? ` (${outcome === 'yes' ? 'Yes' : 'No'}${outcomeDate ? ', ' + outcomeDate : ''})` : ''}${b.apply_all ? ' (linked: applied to all buildings, including buildings added later)' : ''}`);
    return ok();
  });
}
