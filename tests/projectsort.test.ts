import test from 'node:test';
import assert from 'node:assert/strict';
import { compareByManagerThenStatus, compareByStatusThenManager, managerNames } from '../lib/projectSort.ts';
test('status then manager', () => {
  const emps = [{ id: 'a', name: 'Zed' }, { id: 'b', name: 'Amr' }];
  const m = managerNames([{ project_id: '1', employee_id: 'a', role: 'manager' }, { project_id: '2', employee_id: 'b', role: 'manager' }, { project_id: '3', employee_id: 'a', role: 'manager' }, { project_id: '3', employee_id: 'b', role: 'manager' }, { project_id: '4', employee_id: 'b', role: 'coordinator' }], emps);
  assert.equal(m.get('3'), 'Amr / Zed'); assert.equal(m.has('4'), false);
  const ps = [{ id: '1', status: 'Closed', name: 'c' }, { id: '2', status: 'In Progress', name: 'b' }, { id: '1b', status: 'In Progress', name: 'x' }, { id: '4', status: 'In Progress', name: 'n' }, { id: '3', status: 'Not Started', name: 'd' }, { id: '2b', status: 'On Hold', name: 'e' }];
  m.set('1b', 'Zed');
  assert.deepEqual([...ps].sort(compareByStatusThenManager(m)).map((p) => p.id), ['2', '1b', '4', '3', '2b', '1']); // In Progress (Amr, Zed, none), Not Started, On Hold, Closed
  assert.deepEqual([...ps].sort(compareByManagerThenStatus(m)).map((p) => p.id), ['2', '3', '1b', '1', '4', '2b']);
});
