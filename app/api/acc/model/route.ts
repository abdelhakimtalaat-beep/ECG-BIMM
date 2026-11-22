import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { accessToken } from '@/lib/accApi';
import { ensureLinked, latestVersion, modelRow, viewerToken } from '@/lib/accModel';
import { assertScope, projectScope } from '@/lib/perm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const uuid = z.string().uuid();
/** What the 3D viewer needs for a project: its model's newest version and a view-only token. Open to everyone who can see the project (general access included). */
export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser(); const u = new URL(req.url); const id = uuid.parse(u.searchParams.get('project_id'));
    const p = await modelRow(id); if (!p) throw new ApiError(404, 'Project not found');
    if (u.searchParams.get('token_only')) return ok(await viewerToken());
    const sc = await projectScope(me, id); const can_edit = sc === 'full' || sc === 'manager';
    const at = await accessToken(); if (!(await ensureLinked(at, p))) return ok({ state: 'unlinked', name: p.name, can_edit });
    if (!p.acc_model_item_id) return ok({ state: 'no_model', name: p.name, can_edit });
    const v = await latestVersion(at, p.acc_project_id!, p.acc_model_item_id); const t = await viewerToken();
    return ok({ state: 'ready', name: p.name, model_name: v.name || p.acc_model_name, version: v.version, modified: v.modified, urn: v.urn, token: t.token, expires_in: t.expires_in, can_edit });
  });
}
/** Administrator / the project's BIM Manager: choose (or clear) the model file of a project. */
export async function PUT(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const b = z.object({ project_id: uuid, item_id: z.string().min(3).max(300), name: z.string().max(300) }).parse(await json(req));
    await assertScope(me, b.project_id, 'manager');
    await q('update projects set acc_model_item_id=$2, acc_model_name=$3 where id=$1', [b.project_id, b.item_id, b.name]); await audit(null, me.email, 'update', 'project', b.project_id, `3D model set: ${b.name}`);
    return ok();
  });
}
export async function DELETE(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const b = z.object({ project_id: uuid }).parse(await json(req)); await assertScope(me, b.project_id, 'manager');
    await q('update projects set acc_model_item_id=null, acc_model_name=null where id=$1', [b.project_id]); await audit(null, me.email, 'update', 'project', b.project_id, '3D model cleared');
    return ok();
  });
}
