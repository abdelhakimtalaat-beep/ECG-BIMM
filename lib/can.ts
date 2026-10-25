// Client-side mirror of the server rules (lib/rules.ts), used only to show/hide controls.
import type { Me } from './types';
import { canCreateProject as _cp, canEditReels as _er, isAdminRole, projectScopeFor } from './rules.ts';
export const isAdmin = (u: Me | null) => isAdminRole(u?.role);
export const canManageData = isAdmin;
export const canCreateProjects = (u: Me | null) => _cp(u?.role);
export const canEditReels = (u: Me | null) => _er(u?.role);
export function canEditProject(u: Me | null, _managerIds?: string[], _coordIds?: string[]): 'full' | 'manager' | 'coordinator' | 'none' {
  return projectScopeFor(u?.role);
}
