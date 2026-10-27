// Workload = Built-up area x Typicality x Function x Coordination x BIM Standards x Scope (Scope = sum of the ticked disciplines) (pure; unit tested).
export const TYPICALITY = { 'No Typical': 1, 'Low Typical': 0.8, 'Medium Typical': 0.6, 'High Typical': 0.4 } as const;
export const FUNCTION_TYPES = { Industrial: 1.2, Hospital: 1.3, 'Residential/Offices/Mixed Use/Other': 1, Villas: 0.6, Landscape: 0.1 } as const;
export const COORDINATION = { 'Internal Coordination': 1, 'Design Review': 0.2 } as const;
export const BIM_STANDARDS = { 'Aggressive Standards': 1.3, 'Normal Standards': 1.0, 'Minimum Standards': 0.8 } as const;
export const SCOPE = { Architecture: 0.3, Structure: 0.2, MEP: 0.5, Infrastructure: 0.2, Landscape: 0.2, 'Lead Consultant': 0.2 } as const;
export const SCOPE_OPTIONS = Object.keys(SCOPE) as (keyof typeof SCOPE)[];
export const TYPICALITY_OPTIONS = Object.keys(TYPICALITY) as (keyof typeof TYPICALITY)[];
export const FUNCTION_OPTIONS = Object.keys(FUNCTION_TYPES) as (keyof typeof FUNCTION_TYPES)[];
export const COORDINATION_OPTIONS = Object.keys(COORDINATION) as (keyof typeof COORDINATION)[];
export const BIM_STANDARDS_OPTIONS = Object.keys(BIM_STANDARDS) as (keyof typeof BIM_STANDARDS)[];

export interface WorkloadInput { built_up_area?: number | null; typicality?: string | null; function_type?: string | null; coordination_type?: string | null; bim_standards?: string | null; scope_items?: string[] | null }
const f = (m: Record<string, number>, k?: string | null) => (k && Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null);
/** Returns null unless the area and all three factors are set (a missing factor is never guessed). */
export function projectWorkload(p: WorkloadInput): number | null {
  const a = Number(p.built_up_area);
  const sc = (p.scope_items ?? []).reduce((s, k) => s + (f(SCOPE, k) ?? 0), 0);
  const t = f(TYPICALITY, p.typicality), bs = f(BIM_STANDARDS, p.bim_standards), fn = f(FUNCTION_TYPES, p.function_type), c = f(COORDINATION, p.coordination_type);
  if (!(a > 0) || t == null || fn == null || c == null || bs == null || !(sc > 0)) return null;
  return Math.round(a * t * fn * c * bs * sc * 100) / 100;
}
