import { handle, ok } from '@/lib/api';
import { requireTab } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';
/** The ACC statistics of one portal project (summaries only; nothing personal). Everyone who can open the Portfolio may read them. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireTab('/projects'); const id = new URL(req.url).searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ linked: false, stats: null });
    const r = await one<any>('select s.stats,s.synced_at,p.acc_project_id from projects p left join acc_project_stats s on s.acc_project_id=p.acc_project_id where p.id=$1', [id]);
    return ok({ linked: !!r?.acc_project_id, stats: r?.stats ?? null, synced_at: r?.synced_at ?? null });
  });
}
