import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, detectExtracted } from '@/lib/accApi';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Administrator: the ACC projects that have extraction data (read only), with what the portal already imported. */
export async function GET() {
  return handle(async () => {
    await requireUser(['admin']); const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1'); if (!c) return ok({ projects: [] });
    const found = await detectExtracted(await accessToken(), c.account_id);
    const nos = (await q<{ project_no: string }>(`select distinct project_no from projects where project_no is not null and project_no<>''`)).map((r) => r.project_no.toLowerCase());
    const st = new Map((await q<any>('select r.acc_project_id,r.last_status,s.synced_at from acc_requests r left join acc_project_stats s on s.acc_project_id=r.acc_project_id')).map((r: any) => [r.acc_project_id, r]));
    return ok({ projects: found.map((p) => { const l = p.name.toLowerCase(); const r: any = st.get(p.id); return { ...p, matches: nos.some((n) => l === n || l.startsWith(n + '-') || l.startsWith(n + ' ')), imported: r?.last_status === 'imported', synced_at: r?.synced_at ?? null }; }) });
  });
}
