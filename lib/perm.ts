// Server-side authorisation. The UI hides controls using the same rules (lib/can.ts) but this file is what protects the data.
import { q } from './db';
import { ApiError } from './auth';
import type { Me } from './types';

export type Scope = 'full' | 'manager' | 'coordinator' | 'none';

export async function projectScope(u: Me, projectId: string): Promise<Scope> {
  if (u.role === 'admin') return 'full';
  if (!u.employee_id) return 'none';
  const rows = await q<{ role: string }>('select role from project_assignments where project_id=$1 and employee_id=$2', [projectId, u.employee_id]);
  if (!rows.length) return 'none';
  if (u.role === 'bim_manager' && rows.some((r) => r.role === 'manager')) return 'manager';
  if ((u.role === 'bim_coordinator' || u.role === 'bim_manager') && rows.some((r) => r.role === 'coordinator' || r.role === 'member')) return 'coordinator';
  return 'none';
}
export const PROJECT_FIELDS: Record<Scope, string[]> = {
  full: ['project_no', 'name', 'cde', 'type', 'built_up_area', 'status', 'notes'],
  manager: ['name', 'cde', 'type', 'built_up_area', 'status', 'notes'],
  coordinator: ['notes'],
  none: [],
};
export async function assertScope(u: Me, projectId: string, min: Exclude<Scope, 'none'>): Promise<Scope> {
  const s = await projectScope(u, projectId);
  const rank = { none: 0, coordinator: 1, manager: 2, full: 3 } as const;
  if (rank[s] < rank[min]) throw new ApiError(403, 'You can only change projects you are assigned to');
  return s;
}
