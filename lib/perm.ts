// Server-side authorisation. The UI hides controls using the same rules (lib/can.ts) but this file is what protects the data.
import { one } from './db';
import { projectScopeFor, type Scope } from './rules';
import { ApiError } from './auth';
import type { Me } from './types';

export type { Scope } from './rules';
export { PROJECT_FIELDS } from './rules';

/** What this user may do to a project: Administrator all; BIM Manager / BIM Coordinator only projects they are assigned to in that role. */
export async function projectScope(u: Me, projectId: string): Promise<Scope> {
  if ((u.role !== 'bim_manager' && u.role !== 'bim_coordinator') || !u.employee_id) return projectScopeFor(u.role, false);
  const r = await one('select 1 from project_assignments where project_id=$1 and employee_id=$2 and role=$3', [projectId, u.employee_id, u.role === 'bim_manager' ? 'manager' : 'coordinator']);
  return projectScopeFor(u.role, !!r);
}
export async function assertScope(u: Me, projectId: string, min: Exclude<Scope, 'none'>): Promise<Scope> {
  const s = await projectScope(u, projectId);
  const rank = { none: 0, coordinator: 1, manager: 2, full: 3 } as const;
  if (rank[s] < rank[min]) throw new ApiError(403, 'You can only change projects you are assigned to');
  return s;
}
