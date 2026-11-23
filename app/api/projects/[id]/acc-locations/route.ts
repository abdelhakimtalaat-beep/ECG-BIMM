import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, requireUser } from '@/lib/auth';
import { audit, q } from '@/lib/db';
import { accessToken, aps } from '@/lib/accApi';
import { ensureLinked, modelRow } from '@/lib/accModel';
import { locationItems, type LNode } from '@/lib/accLocations';
import { assertScope } from '@/lib/perm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const uuid = z.string().uuid();

/** The location tree of an ACC project (Project Admin > Locations), read only. */
async function readTree(token: string, accProjectId: string): Promise<LNode[]> {
  const out: LNode[] = []; const seen = new Set<string>(); const pid = accProjectId.replace(/^b\./, '');
  for (let offset = 0, i = 0; i < 30; i++) {
    const r: any = await aps(token, `/construction/locations/v2/projects/${pid}/trees/default/nodes?limit=200&offset=${offset}`); const rows: LNode[] = r?.results ?? r?.nodes ?? [];
    const fresh = rows.filter((n) => n?.id && !seen.has(n.id)); fresh.forEach((n) => seen.add(n.id)); out.push(...fresh);
    const total = Number(r?.pagination?.totalResults); if (!fresh.length || (Number.isFinite(total) && out.length >= total)) break; offset += rows.length;
  }
  return out;
}
const unavailable = (e: any) => /Autodesk (403|404)/.test(String(e?.message));

/** Lists the first level (depth 1) or the first two levels (depth 2) of the ACC locations, marking the ones the project already has. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const id = uuid.parse((await ctx.params).id); await assertScope(me, id, 'manager');
    const depth = new URL(req.url).searchParams.get('depth') === '2' ? 2 : 1;
    const p = await modelRow(id); if (!p) throw new ApiError(404, 'Project not found');
    const at = await accessToken(); const acc = await ensureLinked(at, p); if (!acc) return ok({ state: 'unlinked', name: p.name });
    let nodes: LNode[]; try { nodes = await readTree(at, acc); } catch (e: any) { if (unavailable(e)) return ok({ state: 'none', name: p.name, message: 'ACC has no Locations for this project, or the account that connected ACC is not a member of it.' }); throw e; }
    const items = locationItems(nodes, depth); if (!items.length) return ok({ state: 'none', name: p.name, message: 'The Locations of this project in ACC are empty. Add them in ACC (Project Admin > Locations).' });
    const have = new Set((await q<{ name: string }>('select name from project_contents where project_id=$1', [id])).map((r) => r.name.toLowerCase()));
    return ok({ state: 'ready', name: p.name, items: items.map((x) => ({ ...x, exists: have.has(x.name.toLowerCase()) })) });
  });
}
/** Adds the chosen ACC locations as project contents. The tree is read again here, so only real ACC locations can be added. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser(); const id = uuid.parse((await ctx.params).id); await assertScope(me, id, 'manager');
    const b = z.object({ depth: z.union([z.literal(1), z.literal(2)]), ids: z.array(z.string().min(1).max(200)).min(1).max(300), kind: z.enum(['Building', 'Infrastructure', 'Landscape', 'Other']) }).parse(await json(req));
    const p = await modelRow(id); if (!p) throw new ApiError(404, 'Project not found'); const at = await accessToken(); const acc = await ensureLinked(at, p); if (!acc) throw new ApiError(400, 'This project is not linked to an ACC project');
    const pick = new Set(b.ids); const items = locationItems(await readTree(at, acc), b.depth as 1 | 2).filter((x) => pick.has(x.id));
    let added = 0; for (const x of items) { const r = await q('insert into project_contents(project_id,name,kind,created_by) values($1,$2,$3,$4) on conflict (project_id, lower(name)) do nothing returning id', [id, x.name, b.kind, me.email]); if (r.length) added++; }
    await audit(null, me.email, 'create', 'project_content', null, `${p.name}: ${added} content item(s) read from ACC Locations`);
    return ok({ added, skipped: items.length - added });
  });
}
