// Role rules in one pure place. lib/perm.ts (server) and lib/can.ts (UI) both use these, and tests/rules.test.ts pins them.
//
//   admin            (Department Manager)  everything: adds/imports projects, assignments, org chart, users, reel statuses
//   bim_manager      edits only projects where he is the assigned BIM Manager (not Project No.) and Planned BIM Reels; the rest is read-only
//   bim_coordinator  edits only projects where he is the assigned BIM Coordinator (same fields as a BIM Manager) and Planned BIM Reels; the rest is read-only
//   viewer, rd_engineer (R&D BIM Engineer), bim_specialist (BIM Specialist)   read-only
export type RoleName = 'admin' | 'bim_manager' | 'bim_coordinator' | 'viewer' | 'rd_engineer' | 'bim_specialist';
export type Scope = 'full' | 'manager' | 'coordinator' | 'none';

/** isAssigned: the user holds the matching assignment (manager for bim_manager, coordinator for bim_coordinator) on the project. */
export const projectScopeFor = (role: RoleName | undefined | null, isAssigned = false): Scope =>
  role === 'admin' ? 'full' : (role === 'bim_manager' || role === 'bim_coordinator') && isAssigned ? 'manager' : 'none';
/** Only the Administrator adds (or imports) projects. */
export const canCreateProject = (role: RoleName | undefined | null) => role === 'admin';
export const REEL_EDITORS: RoleName[] = ['admin', 'bim_manager', 'bim_coordinator'];
export const canEditReels = (role: RoleName | undefined | null) => !!role && REEL_EDITORS.includes(role);
/** BIM Managers/Coordinators may edit a reel only while it is still Planned (and may add new Planned ones). */
export const canEditReel = (role: RoleName | undefined | null, status: string) => role === 'admin' || (canEditReels(role) && status === 'Planned');
/** Changing a reel's status is Administrator-only. */
export const canChangeReelStatus = (role: RoleName | undefined | null) => role === 'admin';
/** Org chart, team assignments, workload settings, imports, users: administrator only. */
export const isAdminRole = (role: RoleName | undefined | null) => role === 'admin';

const ADMIN_ONLY = ['project_no']; // the Workload Factors are editable by everyone who can edit the project
const ALL = ['project_no', 'typicality', 'function_type', 'coordination_type', 'bim_standards', 'scope_items', 'scope_site', 'plot_area', 'name', 'cde', 'type', 'deltek_number', 'project_manager', 'technical_manager', 'client', 'built_up_area', 'country', 'city', 'revit_version', 'status', 'notes'];
export const PROJECT_FIELDS: Record<Scope, string[]> = {
  full: ALL,
  manager: ALL.filter((f) => !ADMIN_ONLY.includes(f)),
  coordinator: [],
  none: [],
};
