// Client names: unify spelling variants and group projects by client. Pure; unit tested. No imports on purpose.
const LEGAL = new Set(['co', 'company', 'ltd', 'limited', 'llc', 'inc', 'corp', 'corporation', 'sae', 'ksc', 'plc', 'the']);
/** Same client = same key: ignores case, accents, punctuation, "&" vs "and", extra spaces and legal endings (Ltd, LLC, Co, S.A.E ...). */
export function clientKey(name: unknown): string {
  const s = String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const w = s.split(' ').filter(Boolean); while (w.length > 1 && LEGAL.has(w[w.length - 1])) w.pop(); while (w.length > 1 && LEGAL.has(w[0])) w.shift();
  return w.join(' ');
}
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
export const tidyName = tidy;
const mixed = (s: string) => s !== s.toLowerCase() && s !== s.toUpperCase();
/** Words that do not tell two companies apart ("Palm Hills" = "Palm Hills Developments"). */
const GENERIC = new Set(['group', 'groups', 'holding', 'holdings', 'development', 'developments', 'developer', 'developers', 'real', 'estate', 'properties', 'property', 'investment', 'investments', 'construction', 'constructions', 'contracting', 'engineering', 'international', 'egypt', 'egyptian', 'for', 'and', 'of', 'al', 'el']);
const sound = (w: string) => { let t = w.replace(/ou/g, 'o').replace(/oo/g, 'o').replace(/ee/g, 'i').replace(/ph/g, 'f').replace(/ck/g, 'k'); if (t.length > 4 && t.endsWith('s')) t = t.slice(0, -1); return t; };
const initials = (w: string[]) => w.map((x) => x[0]).join('');
const dist = (a: string, b: string): number => { const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } } return d[b.length]; };
/** Two words are the same word spelled differently (Mostafa / Moustafa / Mustafa). Short words must match exactly. */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && dist(a, b) <= (Math.min(a.length, b.length) >= 9 ? 2 : 1));
interface Info { full: string[]; core: string[] }
function analyze(name: string): Info {
  let w = clientKey(name).split(' ').filter(Boolean);
  if (w.length >= 3) { if (w[0].length <= 5 && w[0] === initials(w.slice(1))) w = w.slice(1); else if (w[w.length - 1].length <= 5 && w[w.length - 1] === initials(w.slice(0, -1))) w = w.slice(0, -1); }   /* "TMG Talaat Moustafa Group": the acronym is dropped */
  const core = w.filter((x) => !GENERIC.has(x)); return { full: w, core: (core.length ? core : w).map(sound) };
}
const isAcronymOf = (a: Info, b: Info) => a.full.length === 1 && a.full[0].length >= 2 && a.full[0].length <= 6 && b.full.length >= 2 && (a.full[0] === initials(b.full) || a.full[0] === initials(b.core));
/** Same client written differently: spelling variants, legal endings, generic words (Group, Developments ...) and acronyms (TMG). */
export function sameClient(x: string, y: string): boolean {
  const kx = clientKey(x), ky = clientKey(y); if (!kx || !ky) return false; if (kx === ky) return true;
  const a = analyze(x), b = analyze(y);
  if (a.core.length === b.core.length && a.core.every((t, i) => sameWord(t, b.core[i]))) return true;
  return isAcronymOf(a, b) || isAcronymOf(b, a);
}
/** Clusters of names that are the same client. Each cluster lists its distinct names. */
export function clusterNames(names: string[]): string[][] {
  const u = [...new Set(names.map(tidy).filter((n) => clientKey(n)))]; const p = u.map((_, i) => i); const f = (i: number): number => (p[i] === i ? i : (p[i] = f(p[i])));
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) if (sameClient(u[i], u[j])) p[f(i)] = f(j);
  const g = new Map<number, string[]>(); u.forEach((n, i) => g.set(f(i), [...(g.get(f(i)) ?? []), n])); return [...g.values()];
}
const acronymLike = (s: string) => !/\s/.test(s) && s.length <= 6 && s === s.toUpperCase();
/** The name to show for a cluster: the most used spelling; acronyms last; then properly capitalised; then the shorter one. */
export function pickName(counts: Map<string, number>): string {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || Number(acronymLike(a[0])) - Number(acronymLike(b[0])) || Number(mixed(b[0])) - Number(mixed(a[0])) || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0][0];
}
export interface Group { key: string; name: string; variants: string[]; count: number }
/** Groups spellings of the same client (see sameClient). */
export function unifyNames(names: (string | null | undefined)[]): Group[] {
  const cnt = new Map<string, number>(); for (const raw of names) { const n = tidy(String(raw ?? '')); if (n && clientKey(n)) cnt.set(n, (cnt.get(n) ?? 0) + 1); }
  return clusterNames([...cnt.keys()]).map((c) => { const m = new Map(c.map((n) => [n, cnt.get(n) ?? 0] as [string, number])); const name = pickName(m); return { key: clientKey(name), name, variants: [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]), count: [...m.values()].reduce((s, v) => s + v, 0) }; }).sort((a, b) => a.name.localeCompare(b.name));
}
/** The most common non-empty value (e.g. the country of a client's projects). */
export function mostCommon(values: (string | null | undefined)[]): string | null {
  const m = new Map<string, number>(); for (const x of values) { const t = tidy(String(x ?? '')); if (t) m.set(t, (m.get(t) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
