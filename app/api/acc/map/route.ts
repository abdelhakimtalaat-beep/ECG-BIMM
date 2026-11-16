import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';

/** Administrator: link a portal project to an ACC project (or clear the link). */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const b = z.object({ project_id: z.string().uuid(), acc_project_id: z.string().trim().max(100).nullable() }).parse(await json(req));
    await q('update projects set acc_project_id=$2 where id=$1', [b.project_id, b.acc_project_id || null]);
    await audit(null, me.email, 'update', 'project', b.project_id, `ACC project link ${b.acc_project_id ? 'set' : 'cleared'}`);
    return ok();
  });
}
