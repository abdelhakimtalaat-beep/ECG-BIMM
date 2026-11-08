import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';
/** Birthday, gender, job start date and uploaded documents: visible to the Administrator and to the employee himself only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'These details are private');
    const e = await one<any>(`select birth_date::text birth_date, gender, job_start_date::text job_start_date, other_certificates from employees where id=$1`, [id]);
    if (!e) throw new ApiError(404, 'Employee not found');
    const docs = await q<any>(`select d.id, d.doc_type, d.attachment_id, d.created_at, a.filename, a.size_bytes from employee_documents d join attachments a on a.id=d.attachment_id where d.employee_id=$1 order by d.created_at`, [id]);
    return ok({ ...e, documents: docs });
  });
}
