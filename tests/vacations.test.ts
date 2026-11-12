import test from 'node:test';
import assert from 'node:assert/strict';
import { vacationDays, needsAutoReply } from '../lib/vacations.ts';
test('vacation days and the auto-reply rule', () => {
  assert.equal(vacationDays('2026-11-10', '2026-11-10'), 1); assert.equal(vacationDays('2026-11-10', '2026-11-12'), 3);
  assert.equal(vacationDays('2026-12-30', '2027-01-02'), 4); assert.equal(vacationDays('2026-11-12', '2026-11-10'), 0); assert.equal(vacationDays('', '2026-11-10'), 0);
  assert.ok(!needsAutoReply(2) && needsAutoReply(3));
});
