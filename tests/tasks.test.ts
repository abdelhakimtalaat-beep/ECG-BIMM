import test from 'node:test';
import assert from 'node:assert/strict';
import { areaCoordinators, canEditTasks, canManageSubAreas, isOverdue, managedProjectIds, taskStats } from '../lib/tasks.ts';

const A = [
  { project_id: 'p1', employee_id: 'm1', role: 'manager' }, { project_id: 'p1', employee_id: 'c1', role: 'coordinator' },
  { project_id: 'p2', employee_id: 'm2', role: 'manager' }, { project_id: 'p2', employee_id: 'c2', role: 'coordinator' },
  { project_id: 'p1', employee_id: 'x1', role: 'member' },
];
test('coordinators of a manager are those on his projects', () => {
  assert.deepEqual([...areaCoordinators('m1', A)], ['c1']);
  assert.deepEqual(managedProjectIds('m2', A), ['p2']);
});
test('who edits tasks / sub-areas', () => {
  assert.equal(canEditTasks('bim_manager', 'm1', 'm1', A), true);
  assert.equal(canEditTasks('bim_manager', 'm2', 'm1', A), false);
  assert.equal(canEditTasks('bim_coordinator', 'c1', 'm1', A), true);
  assert.equal(canEditTasks('bim_coordinator', 'c2', 'm1', A), false);
  assert.equal(canEditTasks('admin', null, 'm1', A), true);
  assert.equal(canEditTasks('viewer', 'm1', 'm1', A), false);
  assert.equal(canManageSubAreas('bim_coordinator', 'c1', 'm1'), false);
  assert.equal(canManageSubAreas('bim_manager', 'm1', 'm1'), true);
});
test('overdue and stats', () => {
  const t = [{ due_date: '2026-10-01', status: 'In Progress' }, { due_date: '2026-10-01', status: 'Completed' }, { due_date: null, status: 'Not Started' }, { due_date: '2026-12-01', status: 'On Hold' }];
  assert.equal(isOverdue(t[0], '2026-10-26'), true);
  assert.equal(isOverdue(t[1], '2026-10-26'), false);
  assert.deepEqual(taskStats(t, '2026-10-26'), { total: 4, done: 1, open: 3, overdue: 1 });
});
