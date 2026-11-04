// Minimal iCalendar (.ics) reader for Outlook / Teams published calendars: events, time zones, recurrence (RRULE / EXDATE / overrides). Pure; unit tested.
export interface IcsEvent { uid: string; start: number; end: number; allDay: boolean; title: string; location: string | null; organizer: string | null; teamsUrl: string | null; busy: boolean; isPrivate: boolean }

// Windows time zone names (used by Outlook) -> IANA
const WIN_TZ: Record<string, string> = {
  'Egypt Standard Time': 'Africa/Cairo', 'Arab Standard Time': 'Asia/Riyadh', 'Arabian Standard Time': 'Asia/Dubai', 'Arabic Standard Time': 'Asia/Baghdad', 'Jordan Standard Time': 'Asia/Amman', 'Middle East Standard Time': 'Asia/Beirut',
  'Israel Standard Time': 'Asia/Jerusalem', 'Turkey Standard Time': 'Europe/Istanbul', 'GTB Standard Time': 'Europe/Bucharest', 'E. Europe Standard Time': 'Europe/Chisinau', 'FLE Standard Time': 'Europe/Kiev', 'South Africa Standard Time': 'Africa/Johannesburg',
  'GMT Standard Time': 'Europe/London', 'UTC': 'UTC', 'Greenwich Standard Time': 'Atlantic/Reykjavik', 'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris', 'Russian Standard Time': 'Europe/Moscow', 'Iran Standard Time': 'Asia/Tehran', 'Arabian Standard Time ': 'Asia/Dubai', 'Pakistan Standard Time': 'Asia/Karachi', 'India Standard Time': 'Asia/Kolkata',
  'Bangladesh Standard Time': 'Asia/Dhaka', 'SE Asia Standard Time': 'Asia/Bangkok', 'China Standard Time': 'Asia/Shanghai', 'Singapore Standard Time': 'Asia/Singapore', 'Tokyo Standard Time': 'Asia/Tokyo', 'AUS Eastern Standard Time': 'Australia/Sydney',
  'E. Africa Standard Time': 'Africa/Nairobi', 'W. Central Africa Standard Time': 'Africa/Lagos', 'Morocco Standard Time': 'Africa/Casablanca', 'Libya Standard Time': 'Africa/Tripoli', 'Sudan Standard Time': 'Africa/Khartoum',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles', 'Atlantic Standard Time': 'America/Halifax',
};
const validTz = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
export function resolveTz(name: string | undefined, vtz: Record<string, number>): string | number | null {
  if (!name) return null; const n = name.replace(/^"|"$/g, '').trim();
  if (WIN_TZ[n]) return WIN_TZ[n]; if (validTz(n)) return n;
  if (n in vtz) return vtz[n]; // fall back to the offset (minutes) declared in the file's VTIMEZONE
  return null;
}
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function tzOffset(tz: string, ts: number): number { // minutes east of UTC at instant ts
  let f = dtfCache.get(tz); if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); dtfCache.set(tz, f); }
  const p: Record<string, number> = {}; for (const x of f.formatToParts(new Date(ts))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000) / 60000;
}
/** Local wall-clock time in a zone (IANA name, fixed offset in minutes, or null = UTC) to a UTC timestamp. */
export function localToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string | number | null): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  if (tz == null) return guess; if (typeof tz === 'number') return guess - tz * 60000;
  let t = guess - tzOffset(tz, guess) * 60000; const o2 = tzOffset(tz, t); t = guess - o2 * 60000; return t;
}

interface Prop { name: string; params: Record<string, string>; value: string }
function unfold(text: string): string[] { return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n'); }
function parseProp(line: string): Prop | null {
  const i = (() => { let q = false; for (let k = 0; k < line.length; k++) { const c = line[k]; if (c === '"') q = !q; else if (c === ':' && !q) return k; } return -1; })();
  if (i < 0) return null; const head = line.slice(0, i), value = line.slice(i + 1);
  const parts: string[] = []; { let cur = '', q = false; for (const c of head) { if (c === '"') { q = !q; cur += c; } else if (c === ';' && !q) { parts.push(cur); cur = ''; } else cur += c; } parts.push(cur); }
  const params: Record<string, string> = {}; for (const p of parts.slice(1)) { const e = p.indexOf('='); if (e > 0) params[p.slice(0, e).toUpperCase()] = p.slice(e + 1).replace(/^"|"$/g, ''); }
  return { name: parts[0].toUpperCase(), params, value };
}
const unesc = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

interface DtVal { y: number; mo: number; d: number; h: number; mi: number; s: number; utc: boolean; date: boolean; tz: string | number | null }
function parseDt(p: Prop, vtz: Record<string, number>): DtVal | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim()); if (!m) return null;
  const date = m[4] === undefined || p.params.VALUE === 'DATE';
  return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0), utc: !!m[7], date, tz: m[7] ? null : resolveTz(p.params.TZID, vtz) };
}
const toUtc = (v: DtVal) => localToUtc(v.y, v.mo, v.d, v.h, v.mi, v.s, v.utc ? null : v.tz);

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
interface Rule { freq: string; interval: number; count?: number; until?: number; byday: { n: number; d: number }[]; bymonthday: number[]; bymonth: number[]; wkst: number }
function parseRule(v: string, vtz: Record<string, number>, tz: string | number | null): Rule | null {
  const m: Record<string, string> = {}; for (const kv of v.split(';')) { const e = kv.indexOf('='); if (e > 0) m[kv.slice(0, e).toUpperCase()] = kv.slice(e + 1); }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(m.FREQ)) return null;
  let until: number | undefined; if (m.UNTIL) { const u = parseDt({ name: 'UNTIL', params: {}, value: m.UNTIL }, vtz); if (u) until = u.utc || u.date ? (u.date ? Date.UTC(u.y, u.mo - 1, u.d, 23, 59, 59) : toUtc(u)) : localToUtc(u.y, u.mo, u.d, u.h, u.mi, u.s, tz); }
  const byday = (m.BYDAY ?? '').split(',').filter(Boolean).map((x) => { const mm = /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim()); return mm ? { n: mm[1] ? +mm[1] : 0, d: DAYS.indexOf(mm[2]) } : null; }).filter((x): x is { n: number; d: number } => !!x && x.d >= 0);
  return { freq: m.FREQ, interval: Math.max(1, +(m.INTERVAL ?? 1) || 1), count: m.COUNT ? +m.COUNT : undefined, until, byday, bymonthday: (m.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number), bymonth: (m.BYMONTH ?? '').split(',').filter(Boolean).map(Number), wkst: Math.max(0, DAYS.indexOf(m.WKST ?? 'MO')) };
}
const dim = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
const dow = (y: number, mo: number, d: number) => new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
const addDays = (y: number, mo: number, d: number, n: number): [number, number, number] => { const t = new Date(Date.UTC(y, mo - 1, d + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
/** Days of a month matching BYDAY (with optional ordinal) and/or BYMONTHDAY. */
function monthDays(y: number, mo: number, r: Rule, startDay: number): number[] {
  const n = dim(y, mo); const out = new Set<number>();
  if (r.byday.length) for (const b of r.byday) { const all: number[] = []; for (let d = 1; d <= n; d++) if (dow(y, mo, d) === b.d) all.push(d); if (!b.n) all.forEach((d) => out.add(d)); else { const x = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (x) out.add(x); } }
  else if (r.bymonthday.length) for (const x of r.bymonthday) { const d = x > 0 ? x : n + 1 + x; if (d >= 1 && d <= n) out.add(d); }
  else if (startDay <= n) out.add(startDay);
  if (r.byday.length && r.bymonthday.length) for (const d of [...out]) if (!r.bymonthday.some((x) => (x > 0 ? x : n + 1 + x) === d)) out.delete(d);
  return [...out].sort((a, b) => a - b);
}
/** Local dates [y,mo,d] of the series, in order, from DTSTART until `limit` (a date after which nothing more is needed). */
function* series(s: DtVal, r: Rule | null, limit: number, hard = 6000): Generator<[number, number, number]> {
  if (!r) { yield [s.y, s.mo, s.d]; return; }
  const startKey = Date.UTC(s.y, s.mo - 1, s.d); let emitted = 0; const stop = (y: number, mo: number, d: number) => Date.UTC(y, mo - 1, d) > limit;
  const ok = () => r.count === undefined || emitted < r.count;
  yield [s.y, s.mo, s.d]; emitted++; // DTSTART is always the first instance
  if (r.freq === 'DAILY') { for (let k = 1; k < hard && ok(); k++) { const [y, mo, d] = addDays(s.y, s.mo, s.d, k * r.interval); if (stop(y, mo, d)) return; if (r.bymonth.length && !r.bymonth.includes(mo)) continue; if (r.byday.length && !r.byday.some((b) => b.d === dow(y, mo, d))) continue; yield [y, mo, d]; emitted++; } return; }
  if (r.freq === 'WEEKLY') {
    const days = r.byday.length ? [...new Set(r.byday.map((b) => b.d))] : [dow(s.y, s.mo, s.d)];
    const ws = (() => { const back = (dow(s.y, s.mo, s.d) - r.wkst + 7) % 7; return addDays(s.y, s.mo, s.d, -back); })();
    for (let w = 0; w < hard && ok(); w++) {
      const base = addDays(ws[0], ws[1], ws[2], w * r.interval * 7);
      const cand = days.map((dd) => (dd - r.wkst + 7) % 7).sort((a, b) => a - b).map((off) => addDays(base[0], base[1], base[2], off));
      for (const [y, mo, d] of cand) { const key = Date.UTC(y, mo - 1, d); if (key <= startKey) continue; if (stop(y, mo, d)) return; if (!ok()) return; if (r.bymonth.length && !r.bymonth.includes(mo)) continue; yield [y, mo, d]; emitted++; }
      if (stop(base[0], base[1], base[2]) && Date.UTC(base[0], base[1] - 1, base[2]) > limit) return;
    }
    return;
  }
  if (r.freq === 'MONTHLY') {
    for (let k = 0; k < hard && ok(); k++) { const t = s.mo - 1 + k * r.interval; const y = s.y + Math.floor(t / 12), mo = (t % 12) + 1; if (Date.UTC(y, mo - 1, 1) > limit) return;
      if (r.bymonth.length && !r.bymonth.includes(mo)) continue;
      for (const d of monthDays(y, mo, r, s.d)) { if (Date.UTC(y, mo - 1, d) <= startKey) continue; if (stop(y, mo, d)) return; if (!ok()) return; yield [y, mo, d]; emitted++; } }
    return;
  }
  for (let k = 0; k < 400 && ok(); k++) { const y = s.y + k * r.interval; if (Date.UTC(y, 0, 1) > limit) return;
    const months = r.bymonth.length ? [...r.bymonth].sort((a, b) => a - b) : [s.mo];
    for (const mo of months) for (const d of monthDays(y, mo, r, s.d)) { if (Date.UTC(y, mo - 1, d) <= startKey) continue; if (stop(y, mo, d)) return; if (!ok()) return; yield [y, mo, d]; emitted++; } }
}

const TEAMS_RE = /https:\/\/teams\.(?:microsoft|live)\.com\/[^\s<>"')\\]+/i;
interface Raw { props: Prop[] }
export function parseIcs(text: string, from: number, to: number): IcsEvent[] {
  const lines = unfold(text); const vtz: Record<string, number> = {}; const evs: Raw[] = [];
  let cur: Prop[] | null = null, tzid: string | null = null, tzOff: number | null = null, inStd = false, alarm = 0;
  const off = (v: string) => { const m = /^([+-])(\d{2})(\d{2})/.exec(v); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : null; };
  for (const ln of lines) {
    const p = parseProp(ln); if (!p) continue;
    if (p.name === 'BEGIN') { if (p.value === 'VALARM') alarm++; else if (p.value === 'VEVENT') cur = []; else if (p.value === 'VTIMEZONE') { tzid = null; tzOff = null; } else if (p.value === 'STANDARD') inStd = true; continue; }
    if (p.name === 'END') { if (p.value === 'VALARM') alarm--; else if (p.value === 'VEVENT' && cur) { evs.push({ props: cur }); cur = null; } else if (p.value === 'VTIMEZONE' && tzid && tzOff != null) vtz[tzid] = tzOff; else if (p.value === 'STANDARD') inStd = false; continue; }
    if (cur) { if (!alarm) cur.push(p); } else if (p.name === 'TZID' && !tzid) tzid = p.value.trim(); else if (p.name === 'TZOFFSETTO' && (inStd || tzOff == null)) tzOff = off(p.value);
  }
  const lim = to + 86400000; const out: IcsEvent[] = [];
  const get = (r: Raw, n: string) => r.props.find((x) => x.name === n);
  const all = (r: Raw, n: string) => r.props.filter((x) => x.name === n);
  const masters = evs.filter((e) => !get(e, 'RECURRENCE-ID')), overrides = evs.filter((e) => get(e, 'RECURRENCE-ID'));
  const ovKey = new Map<string, Raw>(); for (const o of overrides) { const rid = parseDt(get(o, 'RECURRENCE-ID')!, vtz); if (rid) ovKey.set(`${get(o, 'UID')?.value}|${rid.date ? `${rid.y}-${rid.mo}-${rid.d}` : toUtc(rid)}`, o); }
  const emit = (r: Raw, start: number, end: number, allDay: boolean) => {
    if (end <= from || start >= to) return;
    if ((get(r, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') return;
    if (/^\s*(canceled|cancelled)\s*:/i.test(unesc(get(r, 'SUMMARY')?.value ?? ''))) return; // Outlook marks cancelled meetings in the title
    const desc = unesc(get(r, 'DESCRIPTION')?.value ?? ''), loc = unesc(get(r, 'LOCATION')?.value ?? '');
    const teams = get(r, 'X-MICROSOFT-SKYPETEAMSMEETINGURL')?.value || get(r, 'X-MICROSOFT-ONLINEMEETINGEXTERNALLINK')?.value || TEAMS_RE.exec(desc)?.[0] || TEAMS_RE.exec(loc)?.[0] || null;
    const org = get(r, 'ORGANIZER'); const busy = (get(r, 'X-MICROSOFT-CDO-BUSYSTATUS')?.value ?? '').toUpperCase() !== 'FREE' && (get(r, 'TRANSP')?.value ?? '').toUpperCase() !== 'TRANSPARENT';
    out.push({ uid: get(r, 'UID')?.value ?? '', start, end, allDay, title: unesc(get(r, 'SUMMARY')?.value ?? '').trim() || '(No title)', location: loc || null, organizer: org?.params.CN ?? (org?.value ? org.value.replace(/^mailto:/i, '') : null), teamsUrl: teams ? teams.replace(/\\/g, '') : null, busy, isPrivate: ['PRIVATE', 'CONFIDENTIAL'].includes((get(r, 'CLASS')?.value ?? '').toUpperCase()) });
  };
  for (const m of masters) {
    const sp = get(m, 'DTSTART'); if (!sp) continue; const s = parseDt(sp, vtz); if (!s) continue;
    const ep = get(m, 'DTEND'), dur = get(m, 'DURATION'); const e = ep ? parseDt(ep, vtz) : null;
    const startUtc = s.date ? Date.UTC(s.y, s.mo - 1, s.d) : toUtc(s);
    let len = 3600000; if (e) len = (e.date ? Date.UTC(e.y, e.mo - 1, e.d) : toUtc(e)) - startUtc; else if (dur) { const dm = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(dur.value); if (dm) len = ((+(dm[1] ?? 0)) * 7 * 86400 + (+(dm[2] ?? 0)) * 86400 + (+(dm[3] ?? 0)) * 3600 + (+(dm[4] ?? 0)) * 60 + +(dm[5] ?? 0)) * 1000; } else if (s.date) len = 86400000;
    if (len < 0) len = 0; const uid = get(m, 'UID')?.value;
    const rr = get(m, 'RRULE'); const rule = rr ? parseRule(rr.value, vtz, s.tz) : null;
    const ex = new Set<number | string>(); for (const x of all(m, 'EXDATE')) for (const v of x.value.split(',')) { const d = parseDt({ ...x, value: v }, vtz); if (d) ex.add(d.date ? `${d.y}-${d.mo}-${d.d}` : toUtc(d)); }
    const lastEnd = rule?.until ? Math.min(lim, rule.until) : lim;
    for (const [y, mo, d] of series(s, rule, lastEnd)) {
      const st = s.date ? Date.UTC(y, mo - 1, d) : localToUtc(y, mo, d, s.h, s.mi, s.s, s.utc ? null : s.tz);
      if (rule?.until && st > rule.until) break;
      const key = s.date ? `${y}-${mo}-${d}` : st; if (ex.has(key)) continue;
      const ov = ovKey.get(`${uid}|${key}`);
      if (ov) { const os = parseDt(get(ov, 'DTSTART')!, vtz), oe = get(ov, 'DTEND') ? parseDt(get(ov, 'DTEND')!, vtz) : null; if (os) { const a = os.date ? Date.UTC(os.y, os.mo - 1, os.d) : toUtc(os); const b = oe ? (oe.date ? Date.UTC(oe.y, oe.mo - 1, oe.d) : toUtc(oe)) : a + len; emit(ov, a, b, os.date); } continue; }
      emit(m, st, st + len, s.date);
    }
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}
