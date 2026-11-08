import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';

/** Mobile and extension number: the Administrator or the employee himself. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.role !== 'admin' && me.employee_id !== id) throw new ApiError(403, 'You can only change your own phone numbers');
    const b = z.object({ mobile: z.string().trim().max(40).nullish().transform((v) => v || null), ext: z.string().trim().max(40).nullish().transform((v) => v || null) }).parse(await json(req));
    const cur = await one<any>('select name,mobile,ext from employees where id=$1', [id]); if (!cur) throw new ApiError(404, 'Employee not found');
    await q('update employees set mobile=$2, ext=$3, updated_at=now() where id=$1', [id, b.mobile, b.ext]);
    await audit(null, me.email, 'update', 'employee', id, `Phone numbers of ${cur.name} updated`, { mobile: cur.mobile, ext: cur.ext }, b);
    return ok(b);
  });
}
