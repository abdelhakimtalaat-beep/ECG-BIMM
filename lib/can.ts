// Client-side mirror of the server rules, used only to show/hide controls.
import type { Me } from './types';
export const isAdmin = (u: Me | null) => u?.role === 'admin';
export const canManageData = (u: Me | null) => u?.role === 'admin';
export function canEditProject(u: Me | null, managerIds: string[], coordIds: string[]): 'full' | 'manager' | 'coordinator' | 'none' {
  if (!u) return 'none';
  if (u.role === 'admin') return 'full';
  if (u.employee_id && u.role === 'bim_manager' && managerIds.includes(u.employee_id)) return 'manager';
  if (u.employee_id && (u.role === 'bim_coordinator' || u.role === 'bim_manager') && coordIds.includes(u.employee_id)) return 'coordinator';
  return 'none';
}
