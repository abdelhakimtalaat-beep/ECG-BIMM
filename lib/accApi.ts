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

// ---- account, requests, extracts
export async function findHub(token: string): Promise<{ account_id: string; name: string }> {
  const hubs = ((await aps(token, '/project/v1/hubs')).data ?? []) as any[];
  const acc = hubs.filter((x) => String(x.id).startsWith('b.'));                       // ACC / BIM 360 hubs have ids that start with "b."; "a." hubs are Fusion hubs and have no Data Connector
  const h = acc.find((x) => String(x.attributes?.extension?.type ?? '').includes('Account')) ?? acc[0];
  if (!h) throw new ApiError(400, `Autodesk shows no ACC hub to this app${hubs.length ? ` (it only sees: ${hubs.map((x) => x.attributes?.name ?? x.id).join(', ')})` : ''}. An ACC Account Admin must add this app's Client ID in Account Admin > Custom Integrations, and your Autodesk account must be a member of the ACC account.`);
  return { account_id: String(h.id).replace(/^b\./, ''), name: h.attributes?.name ?? '' };
}
export async function ensureRequest(token: string, accountId: string): Promise<string> {
  const list = await aps(token, `/data-connector/v1/accounts/${accountId}/requests?limit=200`);
  const mine = ((list?.results ?? list?.data ?? []) as any[]).find((r) => r.description === REQ_NAME && r.isActive !== false);
  if (mine?.id) return mine.id;
  const made = await aps(token, `/data-connector/v1/accounts/${accountId}/requests`, { method: 'POST', body: JSON.stringify({ description: REQ_NAME, isActive: true, scheduleInterval: 'DAY', reoccuringInterval: 1, effectiveFrom: new Date().toISOString(), serviceGroups: ['all'], sendEmail: false }) });
  if (!made?.id) throw new ApiError(502, 'Autodesk did not return the id of the new extract request');
  return made.id;
}
/** Asks Autodesk for an extract right now (one time), in addition to the daily one. */
export async function requestNow(token: string, accountId: string): Promise<void> {
  await aps(token, `/data-connector/v1/accounts/${accountId}/requests`, { method: 'POST', body: JSON.stringify({ description: REQ_NAME + ' (one time)', isActive: true, scheduleInterval: 'ONE_TIME', effectiveFrom: new Date().toISOString(), serviceGroups: ['all'], sendEmail: false }) });
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
/** Imports the newest finished extract (if it is new) and refreshes the per-project statistics. Never stores personal data. */
export async function syncNow(): Promise<SyncResult> {
  const token = await accessToken(); const conn = await one<any>('select * from acc_connection where id=1');
  const accountId = conn.account_id as string; const requestId = conn.request_id || (await ensureRequest(token, accountId));
  if (requestId !== conn.request_id) await q('update acc_connection set request_id=$1 where id=1', [requestId]);
  const jl = await aps(token, `/data-connector/v1/accounts/${accountId}/requests/${requestId}/jobs?limit=20&sort=desc`);
  const jobs = ((jl?.results ?? jl?.data ?? []) as any[]).filter((j) => /complete|success/i.test(String(j.status))).sort((a, b) => String(b.completedAt ?? b.createdAt ?? '').localeCompare(String(a.completedAt ?? a.createdAt ?? '')));
  if (!jobs.length) { const m = 'Autodesk has not finished an extract yet (the first one can take a day). Try "Request extract now".'; await q(`update acc_connection set last_status='waiting', last_error=null, last_sync_at=now() where id=1`); return { status: 'waiting', message: m }; }
  const job = jobs[0];
  if (job.id === conn.last_job_id) { await q(`update acc_connection set last_status='up_to_date', last_error=null, last_sync_at=now() where id=1`); return { status: 'up_to_date', message: 'The newest extract was already imported.' }; }
  const listing = await aps(token, `/data-connector/v1/accounts/${accountId}/jobs/${job.id}/data-listing`);
  const files = ((listing?.results ?? listing?.data ?? listing ?? []) as any[]); const f = files.find((x) => /\.zip$/i.test(String(x.name ?? x))) ?? files[0];
  if (!f) throw new ApiError(502, 'The finished extract has no files');
  const zip = await download(token, `${BASE}/data-connector/v1/accounts/${accountId}/jobs/${job.id}/data/${encodeURIComponent(f.name ?? f)}`);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); const stats = summarizeZip(zip, today);
  for (const s of stats) await q(`insert into acc_project_stats(acc_project_id,name,stats,synced_at) values($1,$2,$3,now()) on conflict (acc_project_id) do update set name=excluded.name, stats=excluded.stats, synced_at=now()`, [s.project_id, s.name, JSON.stringify(s)]);
  await q(`update projects p set acc_project_id=s.acc_project_id from acc_project_stats s where p.acc_project_id is null and p.project_no is not null and p.project_no<>'' and (lower(s.name)=lower(p.project_no) or lower(s.name) like lower(p.project_no)||'-%' or lower(s.name) like lower(p.project_no)||' %')`);
  await q(`update acc_connection set last_job_id=$1, last_sync_at=now(), last_status='imported', last_error=null where id=1`, [job.id]);
  return { status: 'imported', message: `Imported ${stats.length} project(s) from the extract of ${String(job.completedAt ?? job.createdAt ?? '').slice(0, 10)}.`, projects: stats.length };
}
