// Proposals: expected man-hours = project workload x Stage factor (the SUM of the ticked stages' factors; the stage list and values are edited by the Administrator). Pure; unit tested.
import { projectWorkload, type Factors, type WorkloadInput } from './workload.ts';

export const STAGES = ['Concept Design', 'Schematic Design', 'Design Development', 'Tender Document', 'IFC', 'Shop Drawings'] as const;
export type StageFactors = Record<string, number>;
/** All stages start at 0 (= not set): the Administrator enters the factors. */
export const DEFAULT_STAGE_FACTORS: StageFactors = Object.fromEntries(STAGES.map((s) => [s, 0]));
/** A saved list replaces the defaults completely (stages can be added, renamed by add + remove, or removed). */
export function mergeStages(stored: unknown): StageFactors {
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const e = Object.entries(stored as Record<string, unknown>).map(([k, v]) => [k, Number(v)] as const).filter(([k, v]) => k.trim() && Number.isFinite(v) && v >= 0);
    if (e.length) return Object.fromEntries(e);
  }
  return { ...DEFAULT_STAGE_FACTORS };
}
export const stageFactorOf = (stages: string[] | null | undefined, f: StageFactors) => Math.round((stages ?? []).reduce((a, s) => a + (f[s] ?? 0), 0) * 1e6) / 1e6;
/** Null while the workload cannot be calculated or the ticked stages have no factor yet. */
export function expectedManHours(input: WorkloadInput, factors: Factors, stageFactors: StageFactors, stages: string[]): { workload: number | null; stageFactor: number; hours: number | null } {
  const workload = projectWorkload(input, factors);
  const stageFactor = stageFactorOf(stages, stageFactors);
  const hours = workload == null || !(stageFactor > 0) ? null : Math.round(workload * stageFactor * 10) / 10;
  return { workload, stageFactor, hours };
}
