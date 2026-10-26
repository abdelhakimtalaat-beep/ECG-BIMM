// Server-side checks for the Tasks tab.
import { ApiError } from './auth';
import { q } from './db';
import { canEditTasks, canManageSubAreas, type AsgRow } from './tasks';
import type { Me } from './types';

const loadAsg = () => q<AsgRow>('select project_id,employee_id,role from project_assignments');
export async function assertTaskEditor(me: Me, managerId: string) {
  if (!canEditTasks(me.role, me.employee_id, managerId, me.role === 'bim_coordinator' ? await loadAsg() : [])) throw new ApiError(403, 'Only this BIM Manager, his BIM Coordinators or the Administrator can change these tasks');
}
export function assertSubAreaManager(me: Me, managerId: string) {
  if (!canManageSubAreas(me.role, me.employee_id, managerId)) throw new ApiError(403, 'Only this BIM Manager or the Administrator can add or remove sub-areas');
}
