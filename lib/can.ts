// Client-side mirror of the server rules (lib/rules.ts), used only to show/hide controls.
import type { Me } from './types';
import { canEditReel as _er2, canCreateProject as _cp, canEditReels as _er, isAdminRole, projectScopeFor } from './rules.ts';
export const isAdmin = (u: Me | null) => isAdminRole(u?.role);
export const canManageData = isAdmin;
export const canCreateProjects = (u: Me | null) => _cp(u?.role);
export const canEditReels = (u: Me | null) => _er(u?.role);
export const canEditReel = (u: Me | null, status: string) => _er2(u?.role, status);
export function canEditProject(u: Me | null, managerIds: string[] = [], coordIds: string[] = []): 'full' | 'manager' | 'coordinator' | 'none' {
  return projectScopeFor(u?.role, !!u?.employee_id && (u.role === 'bim_coordinator' ? coordIds : managerIds).includes(u.employee_id));
}
