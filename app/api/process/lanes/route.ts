import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { assertScope } from '@/lib/perm';
import { LANES } from '@/lib/processMap';

/** Replaces the set of rows (lanes) removed from a project's Process Map. Administrator or the assigned BIM Manager. At least one row stays. */
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const b = z.object({ project_id: z.string().uuid(), hidden: z.array(z.string()).max(50) }).parse(await json(req));
    const ids = new Set(LANES.map((l) => l.id));
    const hidden = [...new Set(b.hidden as string[])].filter((id) => ids.has(id));
    if (hidden.length >= LANES.length) throw new ApiError(400, 'At least one row must stay on the map');
    await assertScope(me, b.project_id, 'manager');
    await q('delete from process_hidden_lanes where project_id=$1', [b.project_id]);
    for (const id of hidden) await q('insert into process_hidden_lanes(project_id,lane_id) values($1,$2)', [b.project_id, id]);
    await audit(null, me.email, 'update', 'process_lanes', b.project_id, hidden.length ? `Rows removed from the Process Map: ${hidden.map((id) => LANES.find((l) => l.id === id)!.label).join(', ')}` : 'All rows shown on the Process Map');
    return ok();
  });
}
