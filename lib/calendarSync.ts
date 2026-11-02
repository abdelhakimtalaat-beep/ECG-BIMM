import { one, q, tx } from './db';
import { parseIcs } from './icsParse';
import { cleanFeedUrl } from './calendarUrl';

export { cleanFeedUrl };
export const WINDOW_PAST_DAYS = 14, WINDOW_FUTURE_DAYS = 120, STALE_MINUTES = 30;
async function download(url: string): Promise<string> {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(cur, { redirect: 'manual', signal: ac.signal, headers: { Accept: 'text/calendar,*/*', 'User-Agent': 'ECG-BIM-Portal/1.0' }, cache: 'no-store' });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { cur = cleanFeedUrl(new URL(r.headers.get('location')!, cur).toString()); continue; }
      if (!r.ok) throw new Error(r.status === 404 || r.status === 403 ? 'The calendar link no longer works (it may have been unpublished). Publish the calendar again and paste the new link.' : `The calendar server answered ${r.status}.`);
      const buf = await r.arrayBuffer(); if (buf.byteLength > 12 * 1024 * 1024) throw new Error('The calendar file is too large.');
      const text = new TextDecoder('utf-8').decode(buf);
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('The link did not return a calendar. Use the ICS link, not the HTML link.');
      return text;
    } catch (e: any) { if (e?.name === 'AbortError') throw new Error('The calendar server took too long to answer.'); throw e; }
    finally { clearTimeout(t); }
  }
  throw new Error('Too many redirects.');
}
type Row = { uid: string; start_at: string; end_at: string; all_day: boolean; title: string; location: string | null; organizer: string | null; teams_url: string | null; is_private: boolean; busy: boolean };
/** Downloads a published calendar and returns its meetings in the sync window (throws a readable message on failure). */
export async function readFeed(url: string): Promise<{ rows: Row[]; note: string | null }> {
  const now = Date.now(); const text = await download(url); const f = now - WINDOW_PAST_DAYS * 86400000, t = now + WINDOW_FUTURE_DAYS * 86400000;
  const rows = parseIcs(text, f, t).slice(0, 5000).map((e) => ({ uid: e.uid, start_at: new Date(e.start).toISOString(), end_at: new Date(e.end).toISOString(), all_day: e.allDay, title: e.title.slice(0, 300), location: e.location?.slice(0, 300) ?? null, organizer: e.organizer?.slice(0, 200) ?? null, teams_url: e.teamsUrl?.slice(0, 1000) ?? null, is_private: e.isPrivate, busy: e.busy }));
  return { rows, note: rows.length ? null : explainEmpty(text, f, t) };
}
/** Why a calendar that was read successfully produced no meetings (shown to the user). */
export function explainEmpty(text: string, from: number, to: number): string {
  const n = (text.match(/^BEGIN:VEVENT/gim) ?? []).length; const r = (text.match(/^RRULE/gim) ?? []).length; const d = (x: number) => new Date(x).toISOString().slice(0, 10);
  const name = /^X-WR-CALNAME:(.*)$/im.exec(text)?.[1]?.trim();
  if (!n) return `The calendar link works but the file contains no events${name ? ` (calendar "${name}")` : ''}. Check that you published your main Calendar (not Birthdays or Holidays) in Outlook on the web, and that your meetings are in it.`;
  const dates = [...text.matchAll(/^DTSTART[^:\n]*:(\d{4})(\d{2})(\d{2})/gim)].map((m) => `${m[1]}-${m[2]}-${m[3]}`).sort();
  return `The calendar was read: the file has ${n} event(s)${r ? `, ${r} recurring` : ''}${dates.length ? `, dated ${dates[0]} to ${dates[dates.length - 1]}` : ''}, but none fall between ${d(from)} and ${d(to)}.`;
}
export async function saveRows(employeeId: string, rows: Row[], note: string | null = null): Promise<void> {
  await tx(async (c) => {
    await c.query('delete from calendar_events where employee_id=$1', [employeeId]);
    if (rows.length) await c.query(`insert into calendar_events(employee_id,uid,start_at,end_at,all_day,title,location,organizer,teams_url,is_private,busy)
      select $1,x.uid,x.start_at,x.end_at,x.all_day,x.title,x.location,x.organizer,x.teams_url,x.is_private,x.busy from jsonb_to_recordset($2::jsonb) as x(uid text,start_at timestamptz,end_at timestamptz,all_day boolean,title text,location text,organizer text,teams_url text,is_private boolean,busy boolean)`, [employeeId, JSON.stringify(rows)]);
    await c.query('update calendar_feeds set last_synced_at=now(), last_error=$3, event_count=$2, updated_at=now() where employee_id=$1', [employeeId, rows.length, note]);
  });
}
export async function syncEmployee(employeeId: string): Promise<{ ok: boolean; count?: number; error?: string; note?: string }> {
  const f = await one<{ url: string }>('select url from calendar_feeds where employee_id=$1', [employeeId]); if (!f) return { ok: false, error: 'No calendar link' };
  try { const { rows, note } = await readFeed(f.url); await saveRows(employeeId, rows, note); return { ok: true, count: rows.length, note: note ?? undefined }; }
  catch (e: any) { await q('update calendar_feeds set last_synced_at=now(), last_error=$2 where employee_id=$1', [employeeId, String(e?.message ?? e).slice(0, 300)]); return { ok: false, error: e?.message ?? 'Sync failed' }; }
}
/** Refreshes feeds not synced for 30 minutes (a few per request; no scheduler is needed). */
export async function refreshStale(max = 6): Promise<void> {
  const rows = await q<{ employee_id: string }>(`select employee_id from calendar_feeds where last_synced_at is null or last_synced_at < now() - ($1 || ' minutes')::interval order by last_synced_at nulls first limit $2`, [String(STALE_MINUTES), max]);
  await Promise.allSettled(rows.map((r) => syncEmployee(r.employee_id)));
}
