import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScopeFor, canCreateProject, canEditReels, isAdminRole, PROJECT_FIELDS } from '../lib/rules.ts';

test('project scope depends on role only', () => {
  assert.equal(projectScopeFor('admin'), 'full');
  assert.equal(projectScopeFor('bim_manager'), 'manager');
  assert.equal(projectScopeFor('bim_coordinator'), 'none');
  assert.equal(projectScopeFor('viewer'), 'none');
  assert.equal(projectScopeFor(undefined), 'none');
});
test('BIM Manager may edit project_no, coordinator nothing', () => {
  assert.ok(PROJECT_FIELDS.manager.includes('project_no'));
  assert.equal(PROJECT_FIELDS.coordinator.length, 0);
});
test('create project / reels / admin-only rules', () => {
  assert.deepEqual(['admin', 'bim_manager', 'bim_coordinator', 'viewer'].map((r) => canCreateProject(r as any)), [true, true, false, false]);
  assert.deepEqual(['admin', 'bim_manager', 'bim_coordinator', 'viewer'].map((r) => canEditReels(r as any)), [true, true, true, false]);
  assert.deepEqual(['admin', 'bim_manager', 'bim_coordinator', 'viewer'].map((r) => isAdminRole(r as any)), [true, false, false, false]);
});
