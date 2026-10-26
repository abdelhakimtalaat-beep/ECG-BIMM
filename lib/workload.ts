// Workload = Built-up area x Typicality factor x Function factor x Coordination factor (pure; unit tested).
export const TYPICALITY = { 'No Typical': 1, 'Low Typical': 0.8, 'Medium Typical': 0.6, 'High Typical': 0.4 } as const;
export const FUNCTION_TYPES = { Industrial: 1.2, Hospital: 1.3, Residential: 1, Landscape: 0.1 } as const;
export const COORDINATION = { 'Internal Coordination': 1, 'Design Review': 0.2 } as const;
export const TYPICALITY_OPTIONS = Object.keys(TYPICALITY) as (keyof typeof TYPICALITY)[];
export const FUNCTION_OPTIONS = Object.keys(FUNCTION_TYPES) as (keyof typeof FUNCTION_TYPES)[];
export const COORDINATION_OPTIONS = Object.keys(COORDINATION) as (keyof typeof COORDINATION)[];

export interface WorkloadInput { built_up_area?: number | null; typicality?: string | null; function_type?: string | null; coordination_type?: string | null }
const f = (m: Record<string, number>, k?: string | null) => (k && Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null);
/** Returns null unless the area and all three factors are set (a missing factor is never guessed). */
export function projectWorkload(p: WorkloadInput): number | null {
  const a = Number(p.built_up_area);
  const t = f(TYPICALITY, p.typicality), fn = f(FUNCTION_TYPES, p.function_type), c = f(COORDINATION, p.coordination_type);
  if (!(a > 0) || t == null || fn == null || c == null) return null;
  return Math.round(a * t * fn * c * 100) / 100;
}
