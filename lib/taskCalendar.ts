// Month calendar of tasks (weeks start on Saturday, like the Egyptian work week). Pure; unit tested. No imports on purpose.
export interface CalTask { id: string; title: string; start_date: string | null; due_date: string | null }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s: string, n: number) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
/** The weeks (Saturday to Friday) that cover a month. month is 1-12. */
export function monthWeeks(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)), last = new Date(Date.UTC(year, month, 0));
  const start = addDays(iso(first), -((first.getUTCDay() + 1) % 7)); const weeks: string[][] = [];
  for (let s = start; s <= iso(last); s = addDays(s, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)));
  return weeks;
}
export const monthOf = (s: string) => ({ year: +s.slice(0, 4), month: +s.slice(5, 7) });
export const shiftMonth = (year: number, month: number, by: number) => { const d = new Date(Date.UTC(year, month - 1 + by, 1)); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }; };
/** The days a task covers: start to due date; with one date only, that day. No dates = not on the calendar. */
export function taskSpan(t: { start_date: string | null; due_date: string | null }): { start: string; end: string } | null {
  const a = t.start_date?.slice(0, 10) || null, b = t.due_date?.slice(0, 10) || null; const s = a ?? b, e = b ?? a; if (!s || !e) return null; return e < s ? { start: e, end: s } : { start: s, end: e };
}
export interface Bar<T> { task: T; col: number; span: number; lane: number; fromPrev: boolean; toNext: boolean }
/** Places the tasks of one week on lanes (rows). Tasks that do not fit in maxLanes are counted per day in `hidden`. */
export function layoutWeek<T extends CalTask>(week: string[], tasks: T[], maxLanes = 3): { bars: Bar<T>[]; hidden: number[]; lanes: number } {
  const w0 = week[0], w6 = week[6]; const hidden = new Array(7).fill(0); const bars: Bar<T>[] = []; const used: boolean[][] = [];
  const items = tasks.map((t) => ({ t, sp: taskSpan(t) })).filter((x): x is { t: T; sp: { start: string; end: string } } => !!x.sp && x.sp.start <= w6 && x.sp.end >= w0)
    .sort((a, b) => (a.sp.start < b.sp.start ? -1 : a.sp.start > b.sp.start ? 1 : 0) || (a.sp.end < b.sp.end ? 1 : a.sp.end > b.sp.end ? -1 : 0) || a.t.title.localeCompare(b.t.title) || a.t.id.localeCompare(b.t.id));
  for (const { t, sp } of items) {
    const col = Math.max(0, week.indexOf(sp.start < w0 ? w0 : sp.start)), endCol = week.indexOf(sp.end > w6 ? w6 : sp.end), span = endCol - col + 1;
    let lane = 0; while (lane < maxLanes && (used[lane] ?? []).slice(col, col + span).some(Boolean)) lane++;
    if (lane >= maxLanes) { for (let c = col; c <= endCol; c++) hidden[c]++; continue; }
    used[lane] = used[lane] ?? new Array(7).fill(false); for (let c = col; c <= endCol; c++) used[lane][c] = true;
    bars.push({ task: t, col, span, lane, fromPrev: sp.start < w0, toNext: sp.end > w6 });
  }
  return { bars, hidden, lanes: Math.min(maxLanes, Math.max(1, used.length)) };
}
/** Every task that falls on a given day (for the day list). */
export const tasksOnDay = <T extends CalTask>(tasks: T[], d: string): T[] => tasks.filter((t) => { const s = taskSpan(t); return !!s && s.start <= d && d <= s.end; });
