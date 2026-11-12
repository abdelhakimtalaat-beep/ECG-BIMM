import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireTab } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

/** The employee withdraws his own request; the Administrator can delete any. */
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireTab('/vacations'); const { id } = await ctx.params; z.string().uuid().parse(id);
    const v = await one<{ employee_id: string; start_date: string; end_date: string }>('select employee_id,start_date::text start_date,end_date::text end_date from vacation_requests where id=$1', [id]);
    if (!v) throw new ApiError(404, 'Request not found');
    if (me.role !== 'admin' && v.employee_id !== me.employee_id) throw new ApiError(403, 'You can only delete your own requests');
    await q('delete from vacation_requests where id=$1', [id]);
    await audit(null, me.email, 'delete', 'vacation', id, `Vacation request ${v.start_date} to ${v.end_date} deleted`);
    return ok();
  });
}
