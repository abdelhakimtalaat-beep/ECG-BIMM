import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScopeFor, canCreateProject, canEditReels, isAdminRole, PROJECT_FIELDS } from '../lib/rules.ts';

test('project scope: admin full, manager only if assigned, others none', () => {
  assert.equal(projectScopeFor('admin'), 'full');
  assert.equal(projectScopeFor('bim_coordinator', true), 'none');
  assert.equal(projectScopeFor('viewer'), 'none');
  assert.equal(projectScopeFor(undefined), 'none');
  assert.equal(PROJECT_FIELDS.coordinator.length, 0);
});
test('reel editors and admin-only rules', () => {
  assert.deepEqual(['admin', 'bim_manager', 'bim_coordinator', 'viewer'].map((r) => canEditReels(r as any)), [true, true, true, false]);
  assert.deepEqual(['admin', 'bim_manager', 'bim_coordinator', 'viewer'].map((r) => isAdminRole(r as any)), [true, false, false, false]);
});

import { canEditReel, canChangeReelStatus } from '../lib/rules.ts';
test('BIM Manager edits only assigned projects; only admin creates', () => {
  assert.equal(projectScopeFor('bim_manager', true), 'manager');
  assert.equal(projectScopeFor('bim_manager', false), 'none');
  assert.equal(projectScopeFor('admin', false), 'full');
  assert.equal(canCreateProject('bim_manager'), false);
  assert.equal(canCreateProject('admin'), true);
  assert.ok(!PROJECT_FIELDS.manager.includes('project_no'));
});
test('reels: managers/coordinators edit Planned only; status is admin-only', () => {
  assert.equal(canEditReel('bim_manager', 'Planned'), true);
  assert.equal(canEditReel('bim_coordinator', 'Completed'), false);
  assert.equal(canEditReel('admin', 'Completed'), true);
  assert.equal(canEditReel('viewer', 'Planned'), false);
  assert.equal(canChangeReelStatus('bim_manager'), false);
  assert.equal(canChangeReelStatus('admin'), true);
});
