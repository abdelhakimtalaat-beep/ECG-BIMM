import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, apsRaw } from '@/lib/accApi';
import { q, one } from '@/lib/db';

export const maxDuration = 60;
/** Administrator: shows what Autodesk answers for the first set-up project (no secrets, no personal data). Uses 3 Autodesk calls. */
export async function POST() {
  return handle(async () => {
    await requireUser(['admin']); const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1'); if (!c) return ok({ text: 'ACC is not connected' });
    const rows = await q<any>(`select acc_project_id, project_name, request_id, once_request_id from acc_requests where request_id is not null order by project_name limit 1`); const r = rows[0];
    if (!r) return ok({ text: 'No project is set up yet' });
    const t = await accessToken(); const base = `/data-connector/v1/accounts/${c.account_id}`; const out: string[] = [`Project: ${r.project_name}`];
    const calls: [string, string][] = [['Daily request', `${base}/requests/${r.request_id}`], ['Daily request jobs', `${base}/requests/${r.request_id}/jobs?limit=5&sort=desc`]];
    if (r.once_request_id) calls.push(['One-time request jobs', `${base}/requests/${r.once_request_id}/jobs?limit=5&sort=desc`]);
    for (const [label, path] of calls) out.push(`\n== ${label}\n${await apsRaw(t, path)}`);
    return ok({ text: out.join('\n') });
  });
}
