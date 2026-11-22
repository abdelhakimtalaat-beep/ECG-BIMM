import { ApiError } from './auth';
import { one, q } from './db';
import { aps } from './accApi';
import { addressKey, sameCountry, addressText, findPlusCode, geocodeQueries, hasAddress, resolveCode, validPoint, type Addr, type Pt } from './geo';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
interface AccProj { id: string; name: string; addr: Addr; pt: Pt | null }
/** Every project of the ACC account with its address (Construction Admin API). Needs an Account Admin to have signed in. */
export async function listAccAddresses(token: string, accountId: string): Promise<AccProj[]> {
  const out: AccProj[] = []; const acc = accountId.replace(/^b\./, '');
  for (let offset = 0, i = 0; i < 20; i++, offset += 200) {
    const r: any = await aps(token, `/construction/admin/v1/accounts/${acc}/projects?limit=200&offset=${offset}`); const rows: any[] = r?.results ?? [];
    for (const p of rows) out.push({ id: String(p.id).replace(/^b\./, ''), name: String(p.name ?? ''), addr: { line1: p.addressLine1, line2: p.addressLine2, city: p.city, state: p.stateOrProvince, postal: p.postalCode, country: p.country }, pt: validPoint(p.latitude, p.longitude) });
    if (rows.length < 200) break;
  }
  return out;
}

/** Free map search (OpenStreetMap Nominatim): at most one request a second, results are remembered during the run. */
const cache = new Map<string, Pt | null>(); let lastCall = 0;
async function geocode(text: string): Promise<Pt | null> {
  const k = text.toLowerCase(); if (cache.has(k)) return cache.get(k)!;
  const wait = 1100 - (Date.now() - lastCall); if (wait > 0) await sleep(wait); lastCall = Date.now();
  let pt: Pt | null = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`, { headers: { 'User-Agent': 'ECG-BIM-Portal/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j: any[] = await r.json(); pt = j[0] ? validPoint(j[0].lat, j[0].lon) : null; }
  } catch { /* the map search is a helper: no answer = try the next text */ }
  cache.set(k, pt); return pt;
}
const first = async (texts: string[]): Promise<Pt | null> => { for (const t of texts) { const p = await geocode(t); if (p) return p; } return null; };

/** The best position for an ACC address: ACC's own coordinates, then a Plus Code, then the street address, then the city. */
export async function locate(a: AccProj): Promise<{ pt: Pt; precision: 'acc' | 'pluscode' | 'address' | 'city' } | { note: string }> {
  if (a.pt) return { pt: a.pt, precision: 'acc' };
  if (!hasAddress(a.addr)) return { note: 'The project has no address in ACC' };
  const qs = geocodeQueries(a.addr); const code = findPlusCode(a.addr.line1) ?? findPlusCode(a.addr.line2);
  if (code) {
    const full = resolveCode(code.code, null); if (full) return { pt: full, precision: 'pluscode' };
    const ref = await first(qs.locality); const p = ref ? resolveCode(code.code, ref) : null; if (p) return { pt: p, precision: 'pluscode' };
  }
  const exact = await first(qs.address); if (exact) return { pt: exact, precision: 'address' };
  const city = await first(qs.city); if (city) return { pt: city, precision: 'city' };
  return { note: 'The address in ACC was not found on the map' };
}

export interface GeoResult { total: number; located: number; unlocated: number; checked: number; more: boolean; message: string }
const norm = (s: string) => s.toLowerCase().trim();
/** Reads the address of every portal project from its ACC project and saves the pin. Unchanged addresses are skipped, so it is quick after the first run. */
export async function refreshLocations(token: string, opts: { force?: boolean } = {}): Promise<GeoResult> {
  const started = Date.now(); const conn = await one<{ account_id: string | null }>('select account_id from acc_connection where id=1'); if (!conn?.account_id) throw new ApiError(400, 'ACC is not connected yet');
  let acc: AccProj[]; try { acc = await listAccAddresses(token, conn.account_id); }
  catch (e: any) { throw new ApiError(502, `Could not read the project addresses from ACC. The account that connected ACC must be an Account Admin. ${String(e.message).slice(0, 220)}`); }
  const byId = new Map(acc.map((p) => [p.id, p]));
  const rows = await q<{ id: string; name: string; project_no: string | null; country: string | null; acc_project_id: string | null; geo_key: string | null; geo_lat: number | null }>('select id,name,project_no,country,acc_project_id,geo_key,geo_lat from projects order by project_no nulls last, name');
  let checked = 0, more = false;
  for (const p of rows) {
    let a = p.acc_project_id ? byId.get(p.acc_project_id.replace(/^b\./, '')) : undefined;
    if (!a) { const no = norm(p.project_no ?? ''); if (no) { const m = acc.filter((x) => { const l = norm(x.name); return l === no || l.startsWith(no + '-') || l.startsWith(no + ' '); }); if (m.length === 1) { a = m[0]; await q('update projects set acc_project_id=$2 where id=$1 and acc_project_id is null', [p.id, a.id]); } } }
    if (!a) { await q(`update projects set geo_note='Not linked to an ACC project (the ACC project name must start with the project number)', geo_updated=now() where id=$1 and geo_lat is null`, [p.id]); continue; }
    if (!sameCountry(p.country, a.addr.country)) { await q(`update projects set geo_lat=null,geo_lng=null,geo_precision=null,geo_address=$2,geo_key=null,geo_note=$3,geo_updated=now() where id=$1`, [p.id, addressText(a.addr) || null, `The ACC address is in "${String(a.addr.country).trim()}" but the project's country in the portal is "${String(p.country).trim()}". Correct the address in ACC`]); continue; }
    const key = addressKey(a.addr, a.pt); if (!opts.force && p.geo_key === key && p.geo_lat !== null) continue;
    if (Date.now() - started > 42_000) { more = true; break; }
    checked++; const r = await locate(a);
    if ('pt' in r) await q('update projects set geo_lat=$2,geo_lng=$3,geo_precision=$4,geo_address=$5,geo_key=$6,geo_note=null,geo_updated=now() where id=$1', [p.id, r.pt.lat, r.pt.lng, r.precision, addressText(a.addr) || null, key]);
    else await q('update projects set geo_lat=null,geo_lng=null,geo_precision=null,geo_address=$2,geo_key=$3,geo_note=$4,geo_updated=now() where id=$1', [p.id, addressText(a.addr) || null, key, r.note]);
  }
  const c = (await one<{ total: number; located: number }>('select count(*)::int as total, count(geo_lat)::int as located from projects'))!;
  return { total: c.total, located: c.located, unlocated: c.total - c.located, checked, more, message: more ? 'Reading more addresses…' : `${c.located} of ${c.total} projects are on the map` };
}
