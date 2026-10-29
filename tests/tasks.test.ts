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

import { TASK_STATUSES, TASK_TEMPLATES, commentMissing } from '../lib/tasks.ts';
test('Pending replaces On Hold; Pending needs a comment; templates', () => {
  assert.ok(TASK_STATUSES.includes('Pending' as any) && !TASK_STATUSES.includes('On Hold' as any));
  assert.equal(commentMissing('Pending', ''), true); assert.equal(commentMissing('Pending', '  '), true); assert.equal(commentMissing('Pending', null), true);
  assert.equal(commentMissing('Pending', 'waiting for client'), false); assert.equal(commentMissing('In Progress', ''), false);
  assert.deepEqual([...TASK_TEMPLATES], ['Prepare BEP', 'Update BEP', 'MIDP', 'P-Info', 'Coordination Section', 'Clash Report', 'Visual Review']);
});

import { canEditTeamTasks, canManageTeams } from '../lib/tasks.ts';
test('teams: admin manages; members and admin edit', () => {
  assert.equal(canManageTeams('admin'), true); assert.equal(canManageTeams('bim_manager'), false);
  assert.equal(canEditTeamTasks('admin', null, []), true);
  assert.equal(canEditTeamTasks('bim_coordinator', 'e1', ['e1', 'e2']), true);
  assert.equal(canEditTeamTasks('bim_manager', 'e9', ['e1']), false);
  assert.equal(canEditTeamTasks('viewer', null, ['e1']), false);
});

import { canChangeTemplate, canSeeTemplate, newTemplateStatus, mailtoLink, outlookWebLink } from '../lib/emailTemplates.ts';
test('email templates: who sees / changes / how links are built', () => {
  assert.equal(newTemplateStatus('admin'), 'approved'); assert.equal(newTemplateStatus('bim_coordinator'), 'pending');
  const pend = { status: 'pending', requested_by: 'a@x.com' }, ok = { status: 'approved', requested_by: 'a@x.com' };
  assert.equal(canSeeTemplate(pend, 'viewer', 'b@x.com'), false); assert.equal(canSeeTemplate(pend, 'viewer', 'a@x.com'), true); assert.equal(canSeeTemplate(pend, 'admin', 'z'), true); assert.equal(canSeeTemplate(ok, 'viewer', 'b@x.com'), true);
  assert.equal(canChangeTemplate(pend, 'viewer', 'a@x.com'), true); assert.equal(canChangeTemplate(ok, 'viewer', 'a@x.com'), false); assert.equal(canChangeTemplate(ok, 'admin', 'z'), true);
  assert.equal(mailtoLink('Hi & bye', 'a\nb'), 'mailto:?subject=Hi%20%26%20bye&body=a%0D%0Ab');
  assert.ok(outlookWebLink('S', 'B').startsWith('https://outlook.office.com/mail/deeplink/compose?subject=S&body=B'));
});
