import test from 'node:test';
import assert from 'node:assert/strict';
import { vacationDays, needsAutoReply } from '../lib/vacations.ts';
test('vacation days and the auto-reply rule', () => {
  assert.equal(vacationDays('2026-11-10', '2026-11-10'), 1); assert.equal(vacationDays('2026-11-10', '2026-11-12'), 3);
  assert.equal(vacationDays('2026-12-30', '2027-01-02'), 4); assert.equal(vacationDays('2026-11-12', '2026-11-10'), 0); assert.equal(vacationDays('', '2026-11-10'), 0);
  assert.ok(!needsAutoReply(2) && needsAutoReply(3));
});

import { afterDecision, canDecideVacation, initialStatus, vacationRoute } from '../lib/vacations.ts';
test('vacation approval chain', () => {
  assert.equal(vacationRoute('bim_specialist', 'm', 'bim_manager'), 'manager');
  assert.equal(vacationRoute('bim_manager', 'dm', 'department_manager'), 'department');
  assert.equal(vacationRoute('bim_manager', 'x', 'bim_manager'), 'department');
  assert.equal(vacationRoute('bim_coordinator', null, null), 'department'); assert.equal(vacationRoute('bim_specialist', 'dm', 'department_manager'), 'department');
  assert.equal(initialStatus('manager'), 'pending_manager'); assert.equal(initialStatus('department'), 'pending_department');
  assert.equal(afterDecision('pending_manager', true), 'pending_department'); assert.equal(afterDecision('pending_department', true), 'approved');
  assert.equal(afterDecision('pending_manager', false), 'rejected'); assert.equal(afterDecision('approved', false), 'approved');
  const v = { status: 'pending_manager' as const, employee_id: 'e', manager_id: 'm' };
  const man = { employee_id: 'm', role: 'bim_manager', isDeptManager: false }, dep = { employee_id: 'd', role: 'bim_manager', isDeptManager: true }, adm = { employee_id: null, role: 'admin', isDeptManager: false };
  assert.ok(canDecideVacation(man, v) && !canDecideVacation(dep, v) && !canDecideVacation(adm, v));
  const w = { ...v, status: 'pending_department' as const };
  assert.ok(canDecideVacation(dep, w) && canDecideVacation(adm, w) && !canDecideVacation(man, w) && !canDecideVacation({ ...dep, employee_id: 'e' }, w));
  assert.ok(!canDecideVacation(dep, { ...w, status: 'approved' }));
});
