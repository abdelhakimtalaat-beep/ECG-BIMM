import { z } from 'zod';
import { handle, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { accessToken } from '@/lib/accApi';
import { browse, ensureLinked, modelRow } from '@/lib/accModel';
import { assertScope } from '@/lib/perm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Administrator / the project's BIM Manager: folders and model files of the project's ACC folder (to pick the 3D model). */
export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser(['admin', 'bim_manager']); const u = new URL(req.url); const id = z.string().uuid().parse(u.searchParams.get('project_id')); await assertScope(me, id, 'manager');
    const p = await modelRow(id); const at = await accessToken(); if (!p || !(await ensureLinked(at, p))) throw new ApiError(400, 'This project is not linked to an ACC project (its number must match the start of the ACC project name)');
    return ok(await browse(at, p.acc_project_id!, u.searchParams.get('folder_id') || undefined));
  });
}
