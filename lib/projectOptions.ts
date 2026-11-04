// Fixed choices of the project "Stages" and "LOD" fields (tick one or more). Pure.
export const PROJECT_STAGES = ['Concept Design', 'Schematic Design', 'Design Development', 'Tender Documents', 'Permits', 'IFC', 'Shop Drawings', 'As-Built'] as const;
export const PROJECT_LODS = ['100', '200', '300', '350', '400', '500'] as const;
/** Keeps the canonical order, drops unknown and duplicate values; null when nothing is ticked. */
export const normalizeChoices = (v: readonly string[] | null | undefined, allowed: readonly string[]): string[] | null => { const set = new Set(v ?? []); const out = allowed.filter((a) => set.has(a)); return out.length ? out : null; };
