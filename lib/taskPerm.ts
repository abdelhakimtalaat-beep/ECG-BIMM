// Server-side checks for the Tasks tab.
import { ApiError } from './auth';
import { q } from './db';
import { canEditTasks, canEditTeamTasks, canManageSubAreas, type AsgRow } from './tasks';
import type { Me } from './types';

const loadAsg = () => q<AsgRow>('select project_id,employee_id,role from project_assignments');
export async function assertTaskEditor(me: Me, managerId: string) {
  if (!canEditTasks(me.role, me.employee_id, managerId, me.role === 'bim_coordinator' ? await loadAsg() : [])) throw new ApiError(403, 'Only this BIM Manager, his BIM Coordinators or the Administrator can change these tasks');
}
export function assertSubAreaManager(me: Me, managerId: string) {
  if (!canManageSubAreas(me.role, me.employee_id, managerId)) throw new ApiError(403, 'Only this BIM Manager or the Administrator can add or remove projects');
}

export interface AreaOwner { manager_id: string | null; team_id: string | null }
const teamMembers = async (teamId: string) => (await q<{ employee_id: string }>('select employee_id from team_members where team_id=$1', [teamId])).map((r) => r.employee_id);
/** Task editor of an area owned by a BIM Manager or by a team. */
export async function assertAreaEditor(me: Me, a: AreaOwner) {
  if (a.team_id) { if (!canEditTeamTasks(me.role, me.employee_id, await teamMembers(a.team_id))) throw new ApiError(403, 'Only the members of this team or the Administrator can change these tasks'); return; }
  return assertTaskEditor(me, a.manager_id!);
}
/** Add / remove projects of an area owned by a BIM Manager or by a team. */
export async function assertAreaManager(me: Me, a: AreaOwner) {
  if (a.team_id) { if (!canEditTeamTasks(me.role, me.employee_id, await teamMembers(a.team_id))) throw new ApiError(403, 'Only the members of this team or the Administrator can add or remove projects'); return; }
  assertSubAreaManager(me, a.manager_id!);
}
