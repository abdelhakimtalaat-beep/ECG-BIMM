// Repeating tasks: the dates of every occurrence. Pure; unit tested. No imports on purpose.
export const REPEAT_MAX = 120;
export type Freq = 'daily' | 'weekly' | 'monthly' | 'days';
export interface Repeat { freq: Freq; weekdays?: number[]; until: string }   /* weekdays: 0 = Sunday ... 6 = Saturday (JavaScript) */
export interface Occ { start: string | null; due: string | null }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const add = (s: string, n: number) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diff = (a: string, b: string) => Math.round((+day(b) - +day(a)) / 86400000);
const lastOfMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
/** The dates a task repeats on, from `base` to `until` (both included). Weekly keeps the weekday of the base date; monthly keeps its day of the month (the 31st becomes the last day of shorter months). */
export function repeatDates(base: string, r: Repeat): string[] {
  const out: string[] = []; if (!/^\d{4}-\d{2}-\d{2}$/.test(base) || !/^\d{4}-\d{2}-\d{2}$/.test(r.until) || r.until < base) return out;
  const cap = REPEAT_MAX + 1;
  if (r.freq === 'monthly') { const d0 = day(base).getUTCDate(); let y = +base.slice(0, 4), m = +base.slice(5, 7) - 1;
    while (out.length < cap) { const d = new Date(Date.UTC(y, m, Math.min(d0, lastOfMonth(y, m)))); const s = iso(d); if (s > r.until) break; if (s >= base) out.push(s); m++; if (m > 11) { m = 0; y++; } } return out; }
  const set = new Set(r.weekdays ?? []);
  for (let s = base; s <= r.until && out.length < cap; s = add(s, r.freq === 'weekly' ? 7 : 1)) if (r.freq !== 'days' || set.has(day(s).getUTCDay())) out.push(s);
  return out;
}
/** The tasks to create: each keeps the length (start to due) of the first one. With no start date, the due date repeats. */
export function occurrences(start: string | null, due: string | null, r: Repeat): Occ[] {
  const base = start ?? due; if (!base) return []; const len = start && due ? Math.max(0, diff(start, due)) : 0;
  return repeatDates(base, r).map((s) => (start ? { start: s, due: due ? add(s, len) : null } : { start: null, due: s }));
}
