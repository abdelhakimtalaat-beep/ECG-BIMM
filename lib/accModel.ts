import { ApiError } from './auth';
import { one, q } from './db';
import { aps, listHubProjects, seal, tokenCall, unseal } from './accApi';

const bId = (id: string) => 'b.' + String(id).replace(/^b\./, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A short-lived token that can only DISPLAY models (scope viewables:read). This is the only token the browser ever receives. */
let cache: { token: string; exp: number } | null = null;
export async function viewerToken(): Promise<{ token: string; expires_in: number }> {
  if (cache && cache.exp - Date.now() > 120_000) return { token: cache.token, expires_in: Math.floor((cache.exp - Date.now()) / 1000) };
  let last = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await one<{ refresh_token: string | null }>('select refresh_token from acc_connection where id=1');
    if (!row?.refresh_token) throw new ApiError(400, 'ACC is not connected yet');
    try {
      const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: unseal(row.refresh_token), scope: 'viewables:read' });
      if (t.refresh_token) await q('update acc_connection set refresh_token=$1 where id=1', [seal(t.refresh_token)]);   /* Autodesk rotates the refresh token */
      const life = Number(t.expires_in) > 0 ? Number(t.expires_in) : 3600; cache = { token: t.access_token, exp: Date.now() + life * 1000 };
      return { token: t.access_token, expires_in: life };
    } catch (e: any) { last = String(e.message ?? e); await sleep(400); }   /* a parallel refresh may have rotated the token: read it again once */
  }
  throw new ApiError(400, `The 3D viewer needs a new ACC permission. An administrator must press "Reconnect ACC" once (Administration > ACC). ${last.slice(0, 160)}`);
}

export interface ModelRow { id: string; name: string; project_no: string | null; acc_project_id: string | null; acc_model_item_id: string | null; acc_model_name: string | null }
export const modelRow = (id: string) => one<ModelRow>('select id,name,project_no,acc_project_id,acc_model_item_id,acc_model_name from projects where id=$1', [id]);
export const hubId = async () => { const c = await one<{ account_id: string | null }>('select account_id from acc_connection where id=1'); if (!c?.account_id) throw new ApiError(400, 'ACC is not connected yet'); return bId(c.account_id); };

/** The newest version of the chosen model file: its name, version number and the URN the viewer loads. */
export async function latestVersion(token: string, accProjectId: string, itemId: string) {
  const tip = await aps(token, `/data/v1/projects/${bId(accProjectId)}/items/${encodeURIComponent(itemId)}/tip`);
  const d = tip?.data; if (!d?.id) throw new ApiError(404, 'The model file was not found in ACC (was it moved or deleted?)');
  const urn: string = d.relationships?.derivatives?.data?.id ?? Buffer.from(d.id).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return { urn, name: String(d.attributes?.displayName ?? d.attributes?.name ?? ''), version: d.attributes?.versionNumber ?? null, modified: d.attributes?.lastModifiedTime ?? null };
}

const MODEL_EXT = /\.(rvt|nwd|nwc|ifc|dwg|dxf|rcp|skp|3dm|fbx|obj|step|stp|ipt|iam|dgn|dwf|dwfx|nwf)$/i;
/** Folders and 3D-capable files of an ACC project folder (no folder = the top folders). */
export async function browse(token: string, accProjectId: string, folderId?: string) {
  const pid = bId(accProjectId);
  if (!folderId) { const r = await aps(token, `/project/v1/hubs/${await hubId()}/projects/${pid}/topFolders`); return { folders: ((r?.data ?? []) as any[]).map((f) => ({ id: f.id as string, name: String(f.attributes?.displayName ?? f.attributes?.name ?? f.id) })), items: [] as { id: string; name: string; modified: string | null }[] }; }
  const r = await aps(token, `/data/v1/projects/${pid}/folders/${encodeURIComponent(folderId)}/contents?page[limit]=200`); const all = (r?.data ?? []) as any[];
  const name = (x: any) => String(x.attributes?.displayName ?? x.attributes?.name ?? x.id);
  return {
    folders: all.filter((x) => x.type === 'folders').map((x) => ({ id: x.id as string, name: name(x) })).sort((a, b) => a.name.localeCompare(b.name)),
    items: all.filter((x) => x.type === 'items' && MODEL_EXT.test(name(x))).map((x) => ({ id: x.id as string, name: name(x), modified: (x.attributes?.lastModifiedTime as string) ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Links the portal project to its ACC project when that has not happened yet: the ACC project name starts with the portal project number. */
export async function ensureLinked(token: string, p: ModelRow): Promise<string | null> {
  if (p.acc_project_id) return p.acc_project_id; const no = (p.project_no ?? '').trim().toLowerCase(); if (!no) return null;
  const c = await one<{ account_id: string | null }>('select account_id from acc_connection where id=1'); if (!c?.account_id) return null;
  let hit: { id: string; name: string } | undefined; try { const hub = await listHubProjects(token, c.account_id); const m = hub.filter((h) => { const l = h.name.toLowerCase(); return l === no || l.startsWith(no + '-') || l.startsWith(no + ' '); }); hit = m.length === 1 ? m[0] : undefined; } catch { return null; }
  if (!hit) return null; const id = hit.id.replace(/^b\./, ''); await q('update projects set acc_project_id=$2 where id=$1 and acc_project_id is null', [p.id, id]); p.acc_project_id = id; return id;
}
