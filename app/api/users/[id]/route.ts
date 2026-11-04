import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, checkPassword, hash, requireUser } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { TAB_HREFS } from '@/lib/tabs';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    const b = z.object({ role: z.enum(['admin', 'bim_manager', 'bim_coordinator', 'viewer', 'rd_engineer', 'bim_specialist']), active: z.boolean(), employee_id: z.string().uuid().nullable(), full_name: z.string().max(120).nullable(), password: z.string(), allowed_tabs: z.array(z.enum(TAB_HREFS as [string, ...string[]])).min(1, 'Choose at least one tab').nullable() }).partial().parse(await json(req));
    const cur = await one<any>('select email,role,active from users where id=$1', [id]);
    if (!cur) throw new ApiError(404, 'User not found');
    const demotes = (b.role && b.role !== 'admin' && cur.role === 'admin') || (b.active === false && cur.role === 'admin');
    if (demotes) {
      const n = await one<{ n: number }>(`select count(*)::int n from users where role='admin' and active and id<>$1`, [id]);
      if ((n?.n ?? 0) === 0) throw new ApiError(400, 'There must be at least one active administrator');
    }
    const sets: string[] = []; const vals: any[] = [];
    for (const k of ['role', 'active', 'employee_id', 'full_name', 'allowed_tabs'] as const) if (k in b) { vals.push(k === 'allowed_tabs' && b.allowed_tabs ? [...new Set(b.allowed_tabs)] : (b as any)[k]); sets.push(`${k}=$${vals.length}`); }
    if (b.password) { checkPassword(b.password); vals.push(await hash(b.password)); sets.push(`password_hash=$${vals.length}`); sets.push('must_change_password=true'); }
    if (!sets.length) throw new ApiError(400, 'Nothing to update');
    vals.push(id);
    await q(`update users set ${sets.join(',')} where id=$${vals.length}`, vals);
    await audit(null, me.email, 'update', 'user', id, `Updated user ${cur.email}: ${Object.keys(b).map((k) => (k === 'password' ? 'password reset' : k)).join(', ')}`);
    return ok();
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; z.string().uuid().parse(id);
    if (me.id === id) throw new ApiError(400, 'You cannot delete your own user');
    const cur = await one<any>('select email,role,active from users where id=$1', [id]);
    if (!cur) throw new ApiError(404, 'User not found');
    if (cur.role === 'admin' && cur.active) {
      const n = await one<{ n: number }>(`select count(*)::int n from users where role='admin' and active and id<>$1`, [id]);
      if ((n?.n ?? 0) === 0) throw new ApiError(400, 'There must be at least one active administrator');
    }
    await q('delete from users where id=$1', [id]);
    await audit(null, me.email, 'delete', 'user', id, `Deleted user ${cur.email}`);
    return ok();
  });
}
