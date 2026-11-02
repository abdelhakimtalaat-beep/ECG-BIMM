import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';

/** Adds a project content (chosen from the project's contents) to the process map. Administrator or the assigned BIM Manager / Coordinator. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ project_id: z.string().uuid(), content_id: z.string().uuid() }).parse(await json(req));
    await assertScope(me, b.project_id, 'manager');
    const c = await one<any>('select c.name,p.name pname from project_contents c join projects p on p.id=c.project_id where c.id=$1 and c.project_id=$2', [b.content_id, b.project_id]);
    if (!c) throw new ApiError(404, 'That item is not part of this project');
    if (await one('select 1 x from process_buildings where content_id=$1', [b.content_id])) throw new ApiError(409, 'Already added to the process map');
    const r = await one<{ id: string }>('insert into process_buildings(project_id,content_id,created_by) values($1,$2,$3) returning id', [b.project_id, b.content_id, me.email]);
    // statuses that were applied to "all buildings" of the project are inherited by the new building
    await q(`insert into process_nodes(building_id,node_key,status,comment,updated_by,updated_at) select $1,node_key,status,null,updated_by,now() from process_project_nodes where project_id=$2 and status<>'Not Started' on conflict do nothing`, [r!.id, b.project_id]);
    await audit(null, me.email, 'create', 'process_building', r!.id, `${c.pname}: ${c.name} added to the BIM Process Map`);
    return ok({ id: r!.id }, 201);
  });
}
