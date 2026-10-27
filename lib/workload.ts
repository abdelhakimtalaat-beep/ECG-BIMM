// Workload = Built-up area x Typicality x Function x Coordination x BIM Standards x Scope
// (Scope = sum of the ticked disciplines). The factor values are editable by the Administrator; these are the defaults. Pure; unit tested.
export const FACTOR_GROUPS = ['typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items'] as const;
export type FactorGroup = (typeof FACTOR_GROUPS)[number];
export type Factors = Record<FactorGroup, Record<string, number>>;
export const FACTOR_TITLES: Record<FactorGroup, string> = { typicality: 'Typicality', function_type: 'Function', coordination_type: 'Coordination', bim_standards: 'BIM Standards', scope_items: 'Scope' };

export const DEFAULT_FACTORS: Factors = {
  typicality: { 'No Typical': 1, 'Low Typical': 0.8, 'Medium Typical': 0.6, 'High Typical': 0.4 },
  function_type: { Industrial: 1.2, Hospital: 1.3, 'Residential/Offices/Mixed Use/Other': 1, Villas: 0.6, Landscape: 0.1 },
  coordination_type: { 'Internal Coordination': 1, 'Design Review': 0.2 },
  bim_standards: { 'Aggressive Standards': 1.3, 'Normal Standards': 1.0, 'Minimum Standards': 0.8 },
  scope_items: { Architecture: 0.3, Structure: 0.2, MEP: 0.5, Infrastructure: 0.2, Landscape: 0.2, 'Lead Consultant': 0.2 },
};
/** Stored factors replace the defaults group by group (a group that was never saved keeps its defaults). */
export function mergeFactors(stored: Partial<Factors> | null | undefined): Factors {
  const out = {} as Factors;
  for (const g of FACTOR_GROUPS) {
    const s = stored?.[g];
    out[g] = s && typeof s === 'object' && Object.keys(s).length ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])) : { ...DEFAULT_FACTORS[g] };
  }
  return out;
}
export const optionsOf = (f: Factors, g: FactorGroup) => Object.keys(f[g]);

export interface WorkloadInput { built_up_area?: number | null; typicality?: string | null; function_type?: string | null; coordination_type?: string | null; bim_standards?: string | null; scope_items?: string[] | null }
const pick = (m: Record<string, number>, k?: string | null) => (k && Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null);
/** Returns null unless the area, all factors and at least one Scope item are set (a missing factor is never guessed). */
export function projectWorkload(p: WorkloadInput, factors: Factors = DEFAULT_FACTORS): number | null {
  const a = Number(p.built_up_area);
  const sc = (p.scope_items ?? []).reduce((s, k) => s + (pick(factors.scope_items, k) ?? 0), 0);
  const t = pick(factors.typicality, p.typicality), bs = pick(factors.bim_standards, p.bim_standards), fn = pick(factors.function_type, p.function_type), c = pick(factors.coordination_type, p.coordination_type);
  if (!(a > 0) || t == null || fn == null || c == null || bs == null || !(sc > 0)) return null;
  return Math.round(a * t * fn * c * bs * sc * 100) / 100;
}
