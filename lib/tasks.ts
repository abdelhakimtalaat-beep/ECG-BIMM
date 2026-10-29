// Tasks tab rules (pure; used by the API and the UI, unit tested).
//   Each BIM Manager has an area. He (and the BIM Coordinators assigned to his projects) edit its tasks; the Administrator edits all.
//   Only the BIM Manager (or the Administrator) adds/removes the project sub-areas of his area. Everyone else reads.
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Pending', 'Completed'] as const;
export const TASK_TEMPLATES = ['Prepare BEP', 'Update BEP', 'MIDP', 'P-Info', 'Coordination Section', 'Clash Report', 'Visual Review'] as const;
/** A Pending task must say why. */
export const commentMissing = (status: string, comment: string | null | undefined) => status === 'Pending' && !(comment ?? '').trim();
export type TaskStatus = (typeof TASK_STATUSES)[number];
export interface AsgRow { project_id: string; employee_id: string; role: string }

/** Coordinators assigned to at least one project that managerId manages. */
export function areaCoordinators(managerId: string, assignments: AsgRow[]): Set<string> {
  const mine = new Set(assignments.filter((a) => a.role === 'manager' && a.employee_id === managerId).map((a) => a.project_id));
  return new Set(assignments.filter((a) => a.role === 'coordinator' && mine.has(a.project_id)).map((a) => a.employee_id));
}
export const managedProjectIds = (managerId: string, assignments: AsgRow[]) => assignments.filter((a) => a.role === 'manager' && a.employee_id === managerId).map((a) => a.project_id);

export function canManageSubAreas(role: string | undefined, employeeId: string | null | undefined, managerId: string): boolean {
  return role === 'admin' || (role === 'bim_manager' && !!employeeId && employeeId === managerId);
}
export function canEditTasks(role: string | undefined, employeeId: string | null | undefined, managerId: string, assignments: AsgRow[]): boolean {
  if (canManageSubAreas(role, employeeId, managerId)) return true;
  return role === 'bim_coordinator' && !!employeeId && areaCoordinators(managerId, assignments).has(employeeId);
}
export const isOverdue = (t: { due_date: string | null; status: string }, today: string) => !!t.due_date && t.due_date < today && t.status !== 'Completed';
export function taskStats(tasks: { due_date: string | null; status: string }[], today: string) {
  return { total: tasks.length, done: tasks.filter((t) => t.status === 'Completed').length, open: tasks.filter((t) => t.status !== 'Completed').length, overdue: tasks.filter((t) => isOverdue(t, today)).length };
}

/** Admin-created teams: the Administrator manages the team and its members; members (and the Administrator) add projects and edit tasks. */
export const canManageTeams = (role: string | undefined) => role === 'admin';
export const canEditTeamTasks = (role: string | undefined, employeeId: string | null | undefined, memberIds: string[]) => role === 'admin' || (!!employeeId && memberIds.includes(employeeId));
