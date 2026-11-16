import { handle, json, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { accUploadBody } from '@/lib/accUpload';

export const maxDuration = 30;
/** Administrator: save the per-project totals that the browser computed from an ACC extract zip. No personal data is sent or stored. */
export async function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin']); const { stats } = accUploadBody.parse(await json(req));
    for (const s of stats) await q(`insert into acc_project_stats(acc_project_id,name,stats,synced_at) values($1,$2,$3,now()) on conflict (acc_project_id) do update set name=excluded.name, stats=excluded.stats, synced_at=now()`, [s.project_id, s.name, JSON.stringify(s)]);
    const linked = await q<{ id: string }>(`update projects p set acc_project_id=s.acc_project_id from acc_project_stats s where p.acc_project_id is null and p.project_no is not null and p.project_no<>'' and (lower(s.name)=lower(p.project_no) or lower(s.name) like lower(p.project_no)||'-%' or lower(s.name) like lower(p.project_no)||' %') returning p.id`);
    await audit(null, me.email, 'update', 'acc', null, `ACC extract uploaded: ${stats.length} project(s), ${linked.length} newly linked`);
    return ok({ projects: stats.length, newly_linked: linked.length });
  });
}
