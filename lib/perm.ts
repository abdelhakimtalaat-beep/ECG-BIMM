// Server-side authorisation. The UI hides controls using the same rules (lib/can.ts) but this file is what protects the data.
import { one } from './db';
import { canChangeAssignmentRole, projectScopeFor, type Scope } from './rules';
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

/** Assignments: the Administrator changes everything; a BIM Manager changes only the BIM Coordinators of the projects he manages. */
export async function assertCanAssign(u: Me, projectId: string, role: string) {
  const isMgr = u.role === 'bim_manager' && !!u.employee_id && !!(await one(`select 1 from project_assignments where project_id=$1 and employee_id=$2 and role='manager'`, [projectId, u.employee_id]));
  if (!canChangeAssignmentRole(u.role, isMgr, role)) throw new ApiError(403, role === 'coordinator' ? 'Only the Administrator or this project\'s BIM Manager can change its BIM Coordinators' : 'Only the Department Manager can change the BIM Manager or other team members');
}
