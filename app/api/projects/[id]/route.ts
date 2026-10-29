import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q, tx } from '@/lib/db';
import { PROJECT_FIELDS, assertScope } from '@/lib/perm';
import { loadFactors } from '@/lib/factors';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();

export async function GET(_: Request, ctx: Ctx) {
  return handle(async () => {
    await requireUser();
    const { id } = await ctx.params; uuid.parse(id);
    const [history, notes] = await Promise.all([
      q('select old_status,new_status,reason,changed_by,changed_at from project_status_history where project_id=$1 order by changed_at desc', [id]),
      q('select id,body,author,created_at from project_notes where project_id=$1 order by created_at desc', [id]),
    ]);
    return ok({ history, notes });
  });
}

const patch = z.object({
  project_no: z.string().trim().max(40).nullable(),
  name: z.string().trim().min(1).max(300),
  cde: z.string().trim().max(60).nullable(),
  type: z.string().trim().max(60).nullable(),
  deltek_number: z.string().trim().max(60).nullable(),
  project_manager: z.string().trim().max(120).nullable(),
  technical_manager: z.string().trim().max(120).nullable(),
  client: z.string().trim().max(200).nullable(),
  country: z.string().trim().max(80).nullable(),
  city: z.string().trim().max(80).nullable(),
  revit_version: z.enum(['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027']).nullable(),
  built_up_area: z.number().nonnegative().nullable(),
  typicality: z.string().trim().max(80).nullable(),
  function_type: z.string().trim().max(80).nullable(),
  coordination_type: z.string().trim().max(80).nullable(),
  bim_standards: z.string().trim().max(80).nullable(),
  scope_items: z.array(z.string().max(80)).max(30).nullable().transform((v) => (v && v.length ? [...new Set(v)] : null)),
  scope_site: z.array(z.string().max(80)).max(30).nullable().transform((v) => (v && v.length ? [...new Set(v)] : null)),
  plot_area: z.number().nonnegative().nullable(),
  status: z.enum(['Not Started', 'In Progress', 'On Hold', 'Closed']),
  notes: z.string().max(5000).nullable(),
  reason: z.string().max(500).optional(),
}).partial();

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params; uuid.parse(id);
    const b = patch.parse(await json(req));
    const scope = await assertScope(me, id, 'coordinator');
    const allowed = PROJECT_FIELDS[scope];
    const keys = Object.keys(b).filter((k) => k !== 'reason');
    const forbidden = keys.filter((k) => !allowed.includes(k));
    if (forbidden.length) throw new ApiError(403, `You cannot change: ${forbidden.join(', ')}`);
    if (!keys.length) throw new ApiError(400, 'Nothing to update');
    if (keys.some((k) => ['typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items', 'scope_site'].includes(k))) {
      const fac: any = await loadFactors();
      for (const g of ['typicality', 'function_type', 'coordination_type', 'bim_standards'] as const) { const v = (b as any)[g]; if (v && !(v in fac[g])) throw new ApiError(400, `Unknown ${g.replace('_type', '')} option: ${v}`); }
      for (const v of (b.scope_items ?? [])) if (!(v in fac.scope_items)) throw new ApiError(400, `Unknown buildings scope option: ${v}`);
      for (const v of (b.scope_site ?? [])) if (!(v in fac.scope_site)) throw new ApiError(400, `Unknown site work scope option: ${v}`);
    }
    await tx(async (c) => {
      const before = (await c.query('select * from projects where id=$1 for update', [id])).rows[0];
      if (!before) throw new ApiError(404, 'Project not found');
      const sets: string[] = []; const vals: any[] = [];
      for (const k of keys) { vals.push((b as any)[k] === '' ? null : (b as any)[k]); sets.push(`${k}=$${vals.length}`); }
      if (keys.includes('built_up_area')) sets.push(`area_note=null`);
      if (keys.includes('status')) sets.push(`status_source='manual'`);
      vals.push(id);
      await c.query(`update projects set ${sets.join(',')}, updated_at=now() where id=$${vals.length}`, vals);
      if (b.status && b.status !== before.status) {
        await c.query('insert into project_status_history(project_id,old_status,new_status,reason,changed_by) values($1,$2,$3,$4,$5)', [id, before.status, b.status, b.reason ?? null, me.email]);
        await audit(c, me.email, 'status', 'project', id, `${before.name}: ${before.status} → ${b.status}`, { status: before.status }, { status: b.status });
      }
      const other = keys.filter((k) => k !== 'status');
      if (other.length) await audit(c, me.email, 'update', 'project', id, `Updated ${other.join(', ')} on ${before.name}`,
        Object.fromEntries(other.map((k) => [k, before[k]])), Object.fromEntries(other.map((k) => [k, (b as any)[k]])));
    });
    return ok();
  });
}

export async function DELETE(_: Request, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(['admin']);
    const { id } = await ctx.params; uuid.parse(id);
    const p = await one<any>('select name,project_no from projects where id=$1', [id]);
    if (!p) throw new ApiError(404, 'Project not found');
    await tx(async (c) => {
      await c.query('delete from projects where id=$1', [id]);
      await audit(c, me.email, 'delete', 'project', id, `Deleted project ${p.project_no ?? ''} ${p.name}`, p);
    });
    return ok();
  });
}
