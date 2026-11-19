import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { accessToken, apsRaw } from '@/lib/accApi';
import { q, one } from '@/lib/db';

export const maxDuration = 60;
/** Administrator: shows what Autodesk answers for the first set-up project (no secrets, no personal data). Read only. */
export async function POST() {
  return handle(async () => {
    await requireUser(['admin']); const c = await one<{ account_id: string }>('select account_id from acc_connection where id=1'); if (!c) return ok({ text: 'ACC is not connected' });
    const rows = await q<any>(`select acc_project_id, project_name, request_id, once_request_id from acc_requests where tracked order by (once_request_id is null), (request_id is null), project_name limit 1`); const r = rows[0];
    if (!r) return ok({ text: 'No project is tracked yet' });
    const t = await accessToken(); const base = `/data-connector/v1/accounts/${c.account_id}`; const out: string[] = [`Project: ${r.project_name}`];
    out.push(`\n== Extract requests listed for this project (read only)\n${await apsRaw(t, `${base}/requests?projectId=${r.acc_project_id}&limit=10`)}`);
    out.push(`\n== Requests of the account that you can see (first page)\n${await apsRaw(t, `${base}/requests?limit=5`)}`);
    return ok({ text: out.join('\n') });
  });
}
