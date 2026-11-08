import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScopeFor, canCreateProject, canEditReels, isAdminRole, PROJECT_FIELDS } from '../lib/rules.ts';

test('project scope: admin full, manager only if assigned, others none', () => {
  assert.equal(projectScopeFor('admin'), 'full');
  
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

test('BIM Coordinator edits assigned projects like a BIM Manager', () => {
  assert.equal(projectScopeFor('bim_coordinator', true), 'manager');
  assert.equal(projectScopeFor('bim_coordinator', false), 'none');
  assert.equal(projectScopeFor('viewer', true), 'none');
});

test('BIM Coordinator edits assigned projects like a BIM Manager', () => {
  assert.equal(projectScopeFor('bim_coordinator', true), 'manager');
  assert.equal(projectScopeFor('bim_coordinator', false), 'none');
});

test('workload factors are editable by those who can edit the project; Project No. stays admin-only', () => {
  assert.ok(PROJECT_FIELDS.manager.includes('typicality') && PROJECT_FIELDS.manager.includes('function_type') && PROJECT_FIELDS.manager.includes('coordination_type'));
  assert.ok(!PROJECT_FIELDS.manager.includes('project_no'));
});

import { canManageCoordinators, canChangeAssignmentRole } from '../lib/rules.ts';
test('BIM Manager changes only the coordinators of his own projects', () => {
  assert.equal(canManageCoordinators('admin', false), true);
  assert.equal(canManageCoordinators('bim_manager', true), true);
  assert.equal(canManageCoordinators('bim_manager', false), false);
  assert.equal(canManageCoordinators('bim_coordinator', true), false);
  assert.equal(canChangeAssignmentRole('bim_manager', true, 'coordinator'), true);
  assert.equal(canChangeAssignmentRole('bim_manager', true, 'manager'), false);
  assert.equal(canChangeAssignmentRole('bim_manager', true, 'member'), false);
  assert.equal(canChangeAssignmentRole('admin', false, 'manager'), true);
});

test('project stages and LOD: fixed choices, canonical order, editable by the Administrator and the project BIM Manager', async () => {
  const { PROJECT_STAGES, PROJECT_LODS, normalizeChoices } = await import('../lib/projectOptions.ts');
  assert.deepEqual([...PROJECT_STAGES], ['Concept Design', 'Schematic Design', 'Design Development', 'Tender Documents', 'Permits', 'IFC', 'Shop Drawings', 'As-Built']);
  assert.deepEqual([...PROJECT_LODS], ['100', '200', '300', '350', '400', '500']);
  assert.deepEqual(normalizeChoices(['IFC', 'Concept Design', 'IFC', 'bogus'], PROJECT_STAGES), ['Concept Design', 'IFC']);
  assert.equal(normalizeChoices([], PROJECT_LODS), null); assert.equal(normalizeChoices(null, PROJECT_LODS), null);
  const { PROJECT_FIELDS } = await import('../lib/rules.ts');
  for (const sc of ['full', 'manager'] as const) for (const f of ['stages', 'lods']) assert.ok(PROJECT_FIELDS[sc].includes(f), `${sc} ${f}`);
});

test('specialists and R&D engineers edit the topic of their own Planned reel', async () => {
  const { canEditOwnReel, OWN_REEL_FIELDS } = await import('../lib/rules.ts');
  assert.equal(canEditOwnReel('bim_specialist', 'Planned', true), true); assert.equal(canEditOwnReel('rd_engineer', 'Planned', true), true);
  assert.equal(canEditOwnReel('bim_specialist', 'Planned', false), false); assert.equal(canEditOwnReel('rd_engineer', 'Completed', true), false);
  assert.equal(canEditOwnReel('viewer', 'Planned', true), false); assert.equal(canEditOwnReel('bim_coordinator', 'Planned', true), false);
  assert.deepEqual([...OWN_REEL_FIELDS], ['topic', 'software']);
});

test('employee documents are recognised by their real signature', async () => {
  const { sniffDoc, DOC_TYPES } = await import('../lib/files.ts');
  assert.equal(sniffDoc(Buffer.from('%PDF-1.7 xxxx'), 'id.pdf')?.mime, 'application/pdf');
  assert.equal(sniffDoc(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'scan.jpg')?.mime, 'image/jpeg');
  assert.equal(sniffDoc(Buffer.from('MZ not a document'), 'virus.pdf'), null); assert.equal(sniffDoc(Buffer.from('%PDF-1.7 xxxx'), 'renamed.exe'), null);
  assert.equal(DOC_TYPES.length, 5);
});
