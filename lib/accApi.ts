// Autodesk Platform Services (APS) client for the ACC Data Connector. The sign-in (3-legged OAuth) is done once by an administrator;
// the refresh token is kept encrypted in the database. Secrets only come from environment variables (APS_CLIENT_ID, APS_CLIENT_SECRET).
import crypto from 'node:crypto';
import { ApiError } from './auth';
import { one, q } from './db';
import { summarizeZip } from './accStats';

const BASE = 'https://developer.api.autodesk.com';
export const SCOPES = 'data:read data:write data:create account:read';
const REQ_NAME = 'ECG BIM Portal daily extract';
export const apsConfigured = () => !!(process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET);
const need = () => { if (!apsConfigured()) throw new ApiError(400, 'APS_CLIENT_ID / APS_CLIENT_SECRET are not set in the server environment'); return { id: process.env.APS_CLIENT_ID!, secret: process.env.APS_CLIENT_SECRET! }; };

// ---- token vault
const key = () => crypto.createHash('sha256').update('acc-token:' + need().secret).digest();
export function seal(text: string): string { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.'); }
export function unseal(s: string): string { const [iv, tag, enc] = s.split('.').map((x) => Buffer.from(x, 'base64')); const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); }

// ---- OAuth
const basic = () => { const c = need(); return 'Basic ' + Buffer.from(`${c.id}:${c.secret}`).toString('base64'); };
export const authorizeUrl = (redirect: string, state: string) => `${BASE}/authentication/v2/authorize?${new URLSearchParams({ response_type: 'code', client_id: need().id, redirect_uri: redirect, scope: SCOPES, state })}`;
async function tokenCall(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string }> {
  const r = await fetch(`${BASE}/authentication/v2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: basic() }, body: new URLSearchParams(body) });
  const t: any = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) throw new ApiError(502, `Autodesk sign-in failed: ${t.developerMessage || t.error_description || t.error || r.status}`);
  return t;
}
export const exchangeCode = (code: string, redirect: string) => tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirect });
/** A fresh access token from the stored refresh token (Autodesk rotates the refresh token, so the new one is saved). */
export async function accessToken(): Promise<string> {
  const row = await one<{ refresh_token: string | null }>('select refresh_token from acc_connection where id=1');
  if (!row?.refresh_token) throw new ApiError(400, 'ACC is not connected yet');
  let t; try { t = await tokenCall({ grant_type: 'refresh_token', refresh_token: unseal(row.refresh_token), scope: SCOPES }); }
  catch (e: any) { await q(`update acc_connection set last_status='reconnect', last_error=$1 where id=1`, [String(e.message).slice(0, 300)]); throw new ApiError(400, 'The ACC connection expired. An administrator must press "Connect ACC" again. ' + e.message); }
  if (t.refresh_token) await q('update acc_connection set refresh_token=$1 where id=1', [seal(t.refresh_token)]);
  return t.access_token;
}
async function aps(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(path.startsWith('http') ? path : BASE + path, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as any) } });
  const text = await r.text(); let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!r.ok) throw new ApiError(502, `Autodesk ${r.status} on ${path.split('?')[0]}: ${String(j?.developerMessage || j?.message || j?.reason || text).slice(0, 300)}`);
  return j;
}

/** Raw answer of Autodesk (status + first 1500 characters), for the Diagnose button. */
export async function apsRaw(token: string, path: string): Promise<string> {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }); const t = await r.text(); return `HTTP ${r.status}\n${t.slice(0, 1500)}`;
}
/** Raw answer of a POST to Autodesk (status + first 1500 characters), for the Diagnose button. */
export async function apsRawPost(token: string, path: string, body: unknown): Promise<string> {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); return `HTTP ${r.status}\n${t.slice(0, 1500)}`;
}
export const oneTimeBody = (projectId: string) => dcBody({ description: `${REQ_NAME} one time extract ${projectId}`, scheduleInterval: 'ONE_TIME', projectId });
// ---- account, requests, extracts
export async function findHub(token: string): Promise<{ account_id: string; name: string }> {
  const hubs = ((await aps(token, '/project/v1/hubs')).data ?? []) as any[];
  const acc = hubs.filter((x) => String(x.id).startsWith('b.'));                       // ACC / BIM 360 hubs have ids that start with "b."; "a." hubs are Fusion hubs and have no Data Connector
  const h = acc.find((x) => String(x.attributes?.extension?.type ?? '').includes('Account')) ?? acc[0];
  if (!h) throw new ApiError(400, `Autodesk shows no ACC hub to this app${hubs.length ? ` (it only sees: ${hubs.map((x) => x.attributes?.name ?? x.id).join(', ')})` : ''}. An ACC Account Admin must add this app's Client ID in Account Admin > Custom Integrations, and your Autodesk account must be a member of the ACC account.`);
  return { account_id: String(h.id).replace(/^b\./, ''), name: h.attributes?.name ?? '' };
}
const dcBody = (extra: Record<string, unknown>) => ({ isActive: true, effectiveFrom: new Date().toISOString(), serviceGroups: ['all'], sendEmail: false, ...extra });
export interface HubProject { id: string; name: string }
/** Projects of the ACC account that the signed-in person can see (ids without the "b." prefix). */
export async function listHubProjects(token: string, accountId: string): Promise<HubProject[]> {
  const out: HubProject[] = []; let url: string | null = `/project/v1/hubs/b.${accountId}/projects?page[limit]=200`;
  for (let i = 0; url && i < 10; i++) { const r: any = await aps(token, url); for (const p of r?.data ?? []) out.push({ id: String(p.id).replace(/^b\./, ''), name: p.attributes?.name ?? '' }); url = r?.links?.next?.href ?? null; }
  return out;
}
/** A daily request for ONE project (Project Admins may only extract their own projects). */
async function ensureProjectRequest(token: string, accountId: string, p: HubProject): Promise<string> {
  const desc = `${REQ_NAME} ${p.id}`; const base = `/data-connector/v1/accounts/${accountId}/requests`;
  const body = dcBody({ description: desc, scheduleInterval: 'DAY', reoccuringInterval: 1, effectiveTo: new Date(Date.now() + 365 * 86400000).toISOString() });   /* Autodesk requires an end date for a recurring request */
  let made; try { made = await aps(token, base, { method: 'POST', body: JSON.stringify({ ...body, projectId: p.id }) }); }
  catch (e: any) { if (!/ 400 /.test(String(e.message))) throw e; made = await aps(token, base, { method: 'POST', body: JSON.stringify({ ...body, projectIdList: [p.id] }) }); }
  if (!made?.id) throw new ApiError(502, 'Autodesk did not return the id of the new extract request');
  return made.id;
}
export interface SetupResult { created: number; skipped: { name: string; reason: string }[]; message: string }
/** Creates (once) a daily extract request for every ACC project whose name starts with a portal project number, or that is already known. */
export async function setupRequests(token: string, accountId: string): Promise<SetupResult> {
  const hub = await listHubProjects(token, accountId); const nos = (await q<{ project_no: string }>(`select distinct project_no from projects where project_no is not null and project_no<>''`)).map((r) => r.project_no.toLowerCase());
  const rowsKnown = await q<{ acc_project_id: string; request_id: string | null; fresh: boolean }>(`select acc_project_id, request_id, (request_id is not null and updated_at > now() - interval '300 days') or (request_id is null and last_error like 'You are not a Project Admin%' and updated_at > now() - interval '7 days') as fresh from acc_requests`);
  const known = new Set(rowsKnown.map((r) => r.acc_project_id)); const fresh = new Set(rowsKnown.filter((r) => r.fresh).map((r) => r.acc_project_id));
  const mine = hub.filter((p) => known.has(p.id) || nos.some((n) => { const l = p.name.toLowerCase(); return l === n || l.startsWith(n + '-') || l.startsWith(n + ' '); }));
  const skipped: SetupResult['skipped'] = []; let created = 0; let left = 0; let quota = false; const started = Date.now(); const queue = mine.filter((p) => !fresh.has(p.id));
  const work = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      if (quota || Date.now() - started > 42000) { left++; continue; }   /* stay inside the server time limit; press Set up projects again for the rest */
      try { const id = await ensureProjectRequest(token, accountId, p); if (!known.has(p.id)) created++; await q(`insert into acc_requests(acc_project_id,project_name,request_id,last_status,last_error,updated_at) values($1,$2,$3,'ready',null,now()) on conflict (acc_project_id) do update set project_name=excluded.project_name, request_id=excluded.request_id, last_status='ready', last_error=null, updated_at=now()`, [p.id, p.name, id]); }
      catch (e: any) { if (/ 429 /.test(String(e.message))) { quota = true; left++; continue; }   /* Autodesk's daily limit: keep what is saved, try again tomorrow */
        const reason = /403|access level|Forbidden/i.test(String(e.message)) ? 'You are not a Project Admin of this project' : String(e.message).slice(0, 200); skipped.push({ name: p.name, reason }); await q(`insert into acc_requests(acc_project_id,project_name,request_id,last_status,last_error,updated_at) values($1,$2,null,'error',$3,now()) on conflict (acc_project_id) do update set last_status='error', last_error=excluded.last_error, updated_at=now()`, [p.id, p.name, reason]); }
    }
  };
  await Promise.all([work(), work(), work(), work(), work(), work()]);
  const ok = mine.length - skipped.length - left;
  return { created, skipped, message: mine.length ? `${ok} of ${mine.length} matching ACC project(s) are set up for the daily import${left ? `; ${left} not done yet${quota ? " because Autodesk's daily request limit for your user was reached - press Set up projects again tomorrow" : ' (press Set up projects again)'}` : ''}${skipped.length ? `; skipped: ${skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}` : ''}.` : `No ACC project (of ${hub.length} visible) starts with one of the portal project numbers.` };
}
/** Asks Autodesk for a fresh one-time extract of every set-up project. */
export async function requestNow(token: string, accountId: string): Promise<{ n: number; error?: string }> {
  const rows = await q<{ acc_project_id: string; project_name: string }>(`select acc_project_id,project_name from acc_requests where request_id is not null and (once_request_id is null or last_status='imported') order by (once_request_id is null) desc, project_name`); let n = 0; let error: string | undefined;
  for (const r of rows) {
    try {
      const made = await aps(token, `/data-connector/v1/accounts/${accountId}/requests`, { method: 'POST', body: JSON.stringify(oneTimeBody(r.acc_project_id)) });
      if (made?.id) await q(`update acc_requests set once_request_id=$2, updated_at=now() where acc_project_id=$1`, [r.acc_project_id, made.id]); n++;
    } catch (e: any) { error = error ?? `${r.project_name}: ${String(e.message).slice(0, 300)}`; if (/ 429 /.test(String(e.message))) break; }
  }
  return { n, error };
}
async function download(token: string, url: string): Promise<Buffer> {
  let r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' });
  for (let i = 0; i < 4 && r.status >= 300 && r.status < 400 && r.headers.get('location'); i++) r = await fetch(r.headers.get('location')!, { redirect: 'manual' });   // signed link: no Authorization header
  if (!r.ok) throw new ApiError(502, `Download of the extract failed (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 2).toString() === 'PK') return buf;
  try { const j = JSON.parse(buf.toString('utf8')); const u = j.signedUrl ?? j.signedURL ?? j.url ?? j.data?.url; if (typeof u === 'string' && u.startsWith('http')) { const r2 = await fetch(u); if (!r2.ok) throw new ApiError(502, `Download of the extract failed (${r2.status})`); return Buffer.from(await r2.arrayBuffer()); } } catch (e) { if (e instanceof ApiError) throw e; }
  throw new ApiError(502, 'Autodesk returned something that is not a zip file');
}

export interface SyncResult { status: 'imported' | 'up_to_date' | 'waiting'; message: string; projects?: number }
/** Imports the newest finished extract of every set-up project (new ones only) and refreshes the statistics. Stops before the server time limit; the next run continues. */
export async function syncNow(): Promise<SyncResult> {
  const started = Date.now(); const token = await accessToken(); const conn = await one<any>('select * from acc_connection where id=1'); const accountId = conn.account_id as string;
  let rows = await q<any>(`select * from acc_requests where request_id is not null order by project_name`);
  if (!rows.length) { await setupRequests(token, accountId); rows = await q<any>(`select * from acc_requests where request_id is not null order by project_name`); }
  if (!rows.length) { const m = 'No ACC project is set up yet. Check that you are Project Admin of a project whose name starts with its portal project number.'; await q(`update acc_connection set last_status='waiting', last_error=$1, last_sync_at=now() where id=1`, [m]); return { status: 'waiting', message: m }; }
  let imported = 0, upToDate = 0, waiting = 0; const problems: string[] = []; const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  for (const r of rows) {
    if (Date.now() - started > 40000) { problems.push('stopped early (time limit); press Import now again for the rest'); break; }
    try {
      let jobs: any[] = []; const seen: string[] = [];
      for (const rid of [r.once_request_id, r.request_id].filter(Boolean)) {
        const jl = await aps(token, `/data-connector/v1/accounts/${accountId}/requests/${rid}/jobs?limit=20&sort=desc`); const all = (jl?.results ?? jl?.data ?? []) as any[];
        for (const j of all) seen.push(String(j.status ?? '?'));
        jobs = all.filter((j) => /complete|success/i.test(String(j.status))).sort((a, b) => String(b.completedAt ?? b.createdAt ?? '').localeCompare(String(a.completedAt ?? a.createdAt ?? '')));
        if (jobs.length) break;
      }
      if (!jobs.length) { waiting++; if (seen.length) problems.push(`${r.project_name}: Autodesk job status ${[...new Set(seen)].join('/')}`); continue; } const job = jobs[0];
      if (job.id === r.last_job_id) { upToDate++; continue; }
      const listing = await aps(token, `/data-connector/v1/accounts/${accountId}/jobs/${job.id}/data-listing`); const files = (listing?.results ?? listing?.data ?? listing ?? []) as any[]; const f = files.find((x) => /\.zip$/i.test(String(x.name ?? x))) ?? files[0];
      if (!f) throw new ApiError(502, 'The finished extract has no files');
      const zip = await download(token, `${BASE}/data-connector/v1/accounts/${accountId}/jobs/${job.id}/data/${encodeURIComponent(f.name ?? f)}`);
      for (const s of summarizeZip(zip, today)) await q(`insert into acc_project_stats(acc_project_id,name,stats,synced_at) values($1,$2,$3,now()) on conflict (acc_project_id) do update set name=excluded.name, stats=excluded.stats, synced_at=now()`, [s.project_id, s.name, JSON.stringify(s)]);
      await q(`update acc_requests set last_job_id=$2, last_status='imported', last_error=null, updated_at=now() where acc_project_id=$1`, [r.acc_project_id, job.id]); imported++;
    } catch (e: any) { problems.push(`${r.project_name}: ${String(e.message).slice(0, 160)}`); await q(`update acc_requests set last_status='error', last_error=$2, updated_at=now() where acc_project_id=$1`, [r.acc_project_id, String(e.message).slice(0, 300)]); }
  }
  await q(`update projects p set acc_project_id=s.acc_project_id from acc_project_stats s where p.acc_project_id is null and p.project_no is not null and p.project_no<>'' and (lower(s.name)=lower(p.project_no) or lower(s.name) like lower(p.project_no)||'-%' or lower(s.name) like lower(p.project_no)||' %')`);
  const status = imported ? 'imported' : waiting && !upToDate ? 'waiting' : 'up_to_date';
  const message = `${imported} project(s) imported, ${upToDate} already up to date, ${waiting} waiting for Autodesk's first extract${problems.length ? `. Problems: ${problems.join(' | ')}` : ''}.`;
  await q(`update acc_connection set last_status=$1, last_error=$2, last_sync_at=now() where id=1`, [status, problems.length ? problems.join(' | ').slice(0, 500) : null]);
  return { status, message, projects: imported };
}
