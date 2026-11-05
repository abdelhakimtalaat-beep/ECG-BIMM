import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabels, itemText, secTitle, canSubmitStage, SECTIONS, bandOf, canEditHr, canEditStage, cleanScore, levelOf, nextStatus, sectionScore, totals, visibleStages, ITEM_KEYS, canCreate } from '../lib/evaluation.ts';
const A = { employeeId: 'e', managerId: 'm', deptIds: ['d'] };
test('form definition matches the template', () => {
  assert.deepEqual(SECTIONS.map((s) => s.items.length), [3, 7, 2, 2, 11, 8, 4]);
  assert.equal(+SECTIONS.filter((s) => !s.extra).reduce((a, s) => a + s.weight, 0).toFixed(2), 100);
  assert.equal(new Set(ITEM_KEYS).size, ITEM_KEYS.length);
});
test('bands, levels, clean', () => {
  assert.deepEqual([10, 8, 7.5, 6, 4, 3, 2, 0.5, 0].map(bandOf), ['A', 'A', 'F', 'F', 'O', 'S', 'S', 'R', 'N']);
  assert.equal(bandOf(null), null);
  assert.deepEqual([100, 91, 90.4, 80, 79.4, 66, 60, 56, 20].map(levelOf), ['A', 'A', 'B+', 'B+', 'B', 'B', 'C+', 'C+', 'C']);
  assert.equal(cleanScore('7.3'), 7.5); assert.equal(cleanScore(11), null); assert.equal(cleanScore(''), null); assert.equal(cleanScore(-1), null);
});
test('scoring', () => {
  const all10: Record<string, number> = {}; for (const k of ITEM_KEYS) all10[k] = 10;
  const t = totals(all10); assert.equal(Math.round(t.core * 100) / 100, 100); assert.equal(t.total, 100); assert.equal(t.level, 'A');
  const s1 = SECTIONS[0]; assert.ok(Math.abs(sectionScore(s1, { '1.1': 10 }) - 13.39 / 3) < 1e-9); // unrated core items count as 0
  const ex = SECTIONS[5]; assert.ok(Math.abs(sectionScore(ex, { 'E1.1': 10, 'E1.2': 5 }) - 5 * 0.75) < 1e-9); // extras: only rated items
  assert.equal(totals({}).total, 0);
});
test('flow and permissions', () => {
  const emp = { role: 'bim_coordinator', employee_id: 'e' }, mgr = { role: 'bim_manager', employee_id: 'm' }, dep = { role: 'bim_manager', employee_id: 'd' }, adm = { role: 'admin', employee_id: null }, other = { role: 'bim_coordinator', employee_id: 'x' };
  assert.equal(nextStatus('self', true), 'manager'); assert.equal(nextStatus('self', false), 'department'); assert.equal(nextStatus('department', true), 'completed');
  assert.ok(canEditStage(emp, A, 'self', 'self')); assert.ok(!canEditStage(emp, A, 'manager', 'self')); assert.ok(!canEditStage(emp, A, 'self', 'manager'));
  assert.ok(canEditStage(mgr, A, 'manager', 'manager')); assert.ok(!canEditStage(mgr, A, 'self', 'manager')); assert.ok(canEditStage(dep, A, 'department', 'department')); assert.ok(canEditStage(adm, A, 'manager', 'manager'));
  assert.deepEqual(visibleStages(emp, A, 'manager'), ['self']); assert.deepEqual(visibleStages(emp, A, 'completed'), ['self', 'manager', 'department']);
  assert.deepEqual(visibleStages(mgr, A, 'department'), ['self', 'manager']); assert.equal(visibleStages(other, A, 'completed'), null); assert.equal(visibleStages(dep, A, 'self')!.length, 3);
  assert.ok(!canEditHr(emp, A, 'self')); assert.ok(!canEditHr(mgr, A, 'manager')); assert.ok(!canEditHr(dep, A, 'department')); assert.ok(canEditHr(adm, A, 'completed'));
  assert.ok(canEditStage(adm, A, 'completed', 'self') && canEditStage(adm, A, 'department', 'self') && !canEditStage(emp, A, 'completed', 'self')); // the Administrator edits any part at any time
  assert.equal(canSubmitStage(emp, A, 'self'), 'self'); assert.equal(canSubmitStage(adm, A, 'manager'), 'manager'); assert.equal(canSubmitStage(adm, A, 'completed'), null); assert.equal(canSubmitStage(emp, A, 'manager'), null);
  assert.ok(!canEditStage({ role: 'x', employee_id: 'e' }, { ...A, deptIds: ['e'] }, 'department', 'department')); // nobody evaluates himself as department manager
  assert.ok(canCreate(mgr, A) && canCreate(dep, A) && canCreate(adm, A) && !canCreate(emp, A));
});

test('editable wording', () => {
  const l = cleanLabels({ items: { '1.1': '  New text ', '1.2': 'Organizing of one\'s own work', 'zzz': 'x', '1.3': '   ' }, sections: { '1': 'Planning', E2: 'BD' } });
  assert.deepEqual(l.items, { '1.1': 'New text' }); assert.deepEqual(l.sections, { '1': 'Planning', E2: 'BD' });
  assert.equal(itemText(SECTIONS[0].items[0], l), 'New text'); assert.equal(itemText(SECTIONS[0].items[1], l), SECTIONS[0].items[1].text); assert.equal(secTitle(SECTIONS[6], l), 'BD'); assert.equal(secTitle(SECTIONS[1], null), 'Interpersonal Skills');
});
