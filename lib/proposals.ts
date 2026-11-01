// Proposals: expected man-hours = project workload x Man-Hour factor (set by the Administrator). Pure; unit tested.
import { projectWorkload, type Factors, type WorkloadInput } from './workload.ts';

export const CALC_FIELDS = ['built_up_area', 'plot_area', 'typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items', 'scope_site'] as const;
/** Null while the workload cannot be calculated or the Man-Hour factor is not set yet. */
export function expectedManHours(input: WorkloadInput, factors: Factors, manHourFactor: number): { workload: number | null; hours: number | null } {
  const workload = projectWorkload(input, factors);
  const hours = workload == null || !(manHourFactor > 0) ? null : Math.round(workload * manHourFactor * 10) / 10;
  return { workload, hours };
}
