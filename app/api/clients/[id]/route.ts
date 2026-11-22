import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, one, q, tx } from '@/lib/db';
import { clientKey } from '@/lib/clients';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const body = z.object({ name: z.string().trim().min(1).max(200).optional(), country: z.string().trim().max(120).nullish(), description: z.string().trim().max(2000).nullish(), name_ar: z.string().trim().max(200).nullish(), merge_into: uuid.optional() });
const projectsOf = async (key: string) => (await q<{ id: string; client: string }>(`select id, client from projects where client is not null`)).filter((p) => clientKey(p.client) === key).map((p) => p.id);

/** Edit the name or country, or merge this client into another one (its projects move to the other client). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const id = uuid.parse((await ctx.params).id); const b = body.parse(await json(req));
    const cur = await one<{ id: string; name: string; key: string; logo_id: string | null; description: string | null; name_ar: string | null }>('select id,name,key,logo_id,description,name_ar from clients where id=$1', [id]); if (!cur) throw new ApiError(404, 'Client not found');
    if (b.merge_into) {
      if (b.merge_into === id) throw new ApiError(400, 'Choose a different client to merge into');
      const to = await one<{ id: string; name: string; logo_id: string | null }>('select id,name,logo_id from clients where id=$1', [b.merge_into]); if (!to) throw new ApiError(404, 'The client to merge into was not found');
      const ids = await projectsOf(cur.key);
      await tx(async (c) => {
        if (ids.length) await c.query('update projects set client=$2 where id = any($1::uuid[])', [ids, to.name]);
        if (cur.logo_id && !to.logo_id) await c.query('update clients set logo_id=$2, updated_at=now() where id=$1', [to.id, cur.logo_id]);
        await c.query('update clients set description=coalesce(description,$2), name_ar=coalesce(name_ar,$3) where id=$1', [to.id, cur.description, cur.name_ar]);
        await c.query('delete from clients where id=$1', [id]);
        if (cur.logo_id && to.logo_id) await c.query('delete from attachments where id=$1', [cur.logo_id]);
        await audit(c, me.email, 'update', 'client', to.id, `Client "${cur.name}" merged into "${to.name}" (${ids.length} project(s))`);
      });
      return ok({ moved: ids.length });
    }
    const name = b.name ?? cur.name; const key = clientKey(name); if (!key) throw new ApiError(400, 'Enter the client name');
    if (key !== cur.key && (await one('select 1 from clients where key=$1 and id<>$2', [key, id]))) throw new ApiError(409, 'Another client already has this name. Use Merge to combine them.');
    const ids = key !== cur.key || name !== cur.name ? await projectsOf(cur.key) : [];
    await tx(async (c) => {
      await c.query('update clients set name=$2, key=$3, country=$4, description=$5, name_ar=$6, updated_at=now() where id=$1', [id, name, key, b.country === undefined ? (await c.query('select country from clients where id=$1', [id])).rows[0]?.country ?? null : b.country || null, b.description === undefined ? cur.description : b.description || null, b.name_ar === undefined ? cur.name_ar : b.name_ar || null]);
      if (ids.length) await c.query('update projects set client=$2 where id = any($1::uuid[])', [ids, name]);   /* the projects follow the new name */
      await audit(c, me.email, 'update', 'client', id, `Client updated: ${name}`);
    });
    return ok();
  });
}
/** Removes the client record (and its logo). The projects keep their client name; "Collect from projects" would add it again. */
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const id = uuid.parse((await ctx.params).id);
    await tx(async (c) => { const old = (await c.query('select name,logo_id from clients where id=$1 for update', [id])).rows[0]; if (!old) throw new ApiError(404, 'Client not found'); await c.query('delete from clients where id=$1', [id]); if (old.logo_id) await c.query('delete from attachments where id=$1', [old.logo_id]); await audit(c, me.email, 'delete', 'client', id, `Client deleted: ${old.name}`); });
    return ok();
  });
}
