// Server-side authorisation. The UI hides controls using the same rules (lib/can.ts) but this file is what protects the data.
import { projectScopeFor, type Scope } from './rules';
import { ApiError } from './auth';
import type { Me } from './types';

export type { Scope } from './rules';
export { PROJECT_FIELDS } from './rules';

/** What this user may do to a project. Roles decide it; assignment to a project no longer matters (see lib/rules.ts). */
export async function projectScope(u: Me, _projectId?: string): Promise<Scope> {
  return projectScopeFor(u.role);
}
export async function assertScope(u: Me, projectId: string, min: Exclude<Scope, 'none'>): Promise<Scope> {
  const s = await projectScope(u, projectId);
  const rank = { none: 0, coordinator: 1, manager: 2, full: 3 } as const;
  if (rank[s] < rank[min]) throw new ApiError(403, 'You do not have permission to change projects');
  return s;
}
