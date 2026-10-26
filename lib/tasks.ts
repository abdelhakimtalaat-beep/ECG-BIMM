// Tasks tab rules (pure; used by the API and the UI, unit tested).
//   Each BIM Manager has an area. He (and the BIM Coordinators assigned to his projects) edit its tasks; the Administrator edits all.
//   Only the BIM Manager (or the Administrator) adds/removes the project sub-areas of his area. Everyone else reads.
export const TASK_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed'] as const;
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
