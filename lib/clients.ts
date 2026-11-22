// Client names: unify spelling variants and group projects by client. Pure; unit tested. No imports on purpose.
const LEGAL = new Set(['co', 'company', 'ltd', 'limited', 'llc', 'inc', 'corp', 'corporation', 'sae', 'ksc', 'plc', 'the']);
/** Same client = same key: ignores case, accents, punctuation, "&" vs "and", extra spaces and legal endings (Ltd, LLC, Co, S.A.E ...). */
export function clientKey(name: unknown): string {
  const s = String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const w = s.split(' ').filter(Boolean); while (w.length > 1 && LEGAL.has(w[w.length - 1])) w.pop(); while (w.length > 1 && LEGAL.has(w[0])) w.shift();
  return w.join(' ');
}
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const mixed = (s: string) => s !== s.toLowerCase() && s !== s.toUpperCase();
export interface Group { key: string; name: string; variants: string[]; count: number }
/** Groups spellings of the same client. The shown name is the most used spelling (ties: properly capitalised, then the shorter one). */
export function unifyNames(names: (string | null | undefined)[]): Group[] {
  const by = new Map<string, Map<string, number>>();
  for (const raw of names) { const n = tidy(String(raw ?? '')); const k = clientKey(n); if (!n || !k) continue; const m = by.get(k) ?? new Map<string, number>(); m.set(n, (m.get(n) ?? 0) + 1); by.set(k, m); }
  return [...by.entries()].map(([key, m]) => {
    const v = [...m.entries()].sort((a, b) => b[1] - a[1] || Number(mixed(b[0])) - Number(mixed(a[0])) || a[0].length - b[0].length || a[0].localeCompare(b[0]));
    return { key, name: v[0][0], variants: v.map((x) => x[0]), count: v.reduce((s, x) => s + x[1], 0) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
/** The most common non-empty value (e.g. the country of a client's projects). */
export function mostCommon(values: (string | null | undefined)[]): string | null {
  const m = new Map<string, number>(); for (const x of values) { const t = tidy(String(x ?? '')); if (t) m.set(t, (m.get(t) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
