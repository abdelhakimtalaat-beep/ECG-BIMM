import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, requestNow } from '@/lib/accApi';
import { audit, one, q } from '@/lib/db';

export const maxDuration = 60;
const body = z.object({ projects: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().max(300) })).max(500), request: z.boolean().optional() });
/** Administrator: saves which ACC projects are tracked; with request=true Autodesk is also asked for a fresh extract of the tracked projects. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']); const b = body.parse(await json(req)); const ids = b.projects.map((p) => p.id);
    await q(`update acc_requests set tracked=false where tracked and not (acc_project_id = any($1::text[]))`, [ids]);
    for (const p of b.projects) await q(`insert into acc_requests(acc_project_id,project_name,last_status,tracked,updated_at) values($1,$2,'selected',true,now()) on conflict (acc_project_id) do update set tracked=true, project_name=excluded.project_name`, [p.id, p.name]);
    let message = `${ids.length} project(s) are tracked.`;
    if (b.request && ids.length) {
      const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1');
      if (c) { const r = await requestNow(await accessToken(), c.account_id); message += r.error ? ` Autodesk accepted ${r.n} extract request(s) and then refused: ${r.error}` : ` ${r.n} extract(s) requested from Autodesk. It usually takes some minutes; press "Import now" later.`; }
    }
    await audit(null, me.email, 'update', 'acc', null, `ACC tracked projects: ${ids.length}`);
    return ok({ message });
  });
}
