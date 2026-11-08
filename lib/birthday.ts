// Birthday alarms for the Administrator. Pure; unit tested. Dates are ISO strings (YYYY-MM-DD).
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const parse = (s: string) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) });
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const addDays = (s: string, n: number) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
/** The date the birthday falls on in `year` (29 February is celebrated on 28 February in a common year). */
export function birthdayIn(birth: string, year: number): string { const b = parse(birth); return b.m === 2 && b.d === 29 && !isLeap(year) ? iso(year, 2, 28) : iso(year, b.m, b.d); }
export interface BirthdayHit { id: string; name: string; date: string; turning: number; days: number }
/** Birthdays from `today` up to `ahead` days later (0 = today only), earliest first. */
export function birthdaysFrom<T extends { id: string; name: string; birth_date: string | null }>(people: T[], today: string, ahead = 0): BirthdayHit[] {
  const y = +today.slice(0, 4); const out: BirthdayHit[] = [];
  for (const p of people) {
    if (!p.birth_date) continue;
    for (const yr of [y, y + 1]) { const d = birthdayIn(p.birth_date, yr); const days = Math.round((Date.parse(d) - Date.parse(today)) / 86400000); if (days >= 0 && days <= ahead) { out.push({ id: p.id, name: p.name, date: d, turning: yr - +p.birth_date.slice(0, 4), days }); break; } }
  }
  return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}
