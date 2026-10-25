// Role rules in one pure place. lib/perm.ts (server) and lib/can.ts (UI) both use these, and tests/rules.test.ts pins them.
//
//   admin            (Department Manager)  everything
//   bim_manager      edits the Projects tab (all projects) and BIM Reels; every other tab is read-only
//   bim_coordinator  edits BIM Reels; everything else is read-only
//   viewer           read-only
export type RoleName = 'admin' | 'bim_manager' | 'bim_coordinator' | 'viewer';
export type Scope = 'full' | 'manager' | 'coordinator' | 'none';

/** Edit rights on a project. BIM Managers may edit every project; nobody else but the administrator may. */
export const projectScopeFor = (role: RoleName | undefined | null): Scope => (role === 'admin' ? 'full' : role === 'bim_manager' ? 'manager' : 'none');
export const canCreateProject = (role: RoleName | undefined | null) => role === 'admin' || role === 'bim_manager';
export const REEL_EDITORS: RoleName[] = ['admin', 'bim_manager', 'bim_coordinator'];
export const canEditReels = (role: RoleName | undefined | null) => !!role && REEL_EDITORS.includes(role);
/** Org chart, team assignments, workload settings, imports, users: administrator only. */
export const isAdminRole = (role: RoleName | undefined | null) => role === 'admin';

export const PROJECT_FIELDS: Record<Scope, string[]> = {
  full: ['project_no', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'built_up_area', 'status', 'notes'],
  manager: ['project_no', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'built_up_area', 'status', 'notes'],
  coordinator: [],
  none: [],
};
