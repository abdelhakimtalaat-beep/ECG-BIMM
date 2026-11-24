import test from 'node:test';
import assert from 'node:assert/strict';
import { occurrences, repeatDates, REPEAT_MAX } from '../lib/taskRepeat.ts';
test('daily and weekly', () => {
  assert.deepEqual(repeatDates('2026-11-28', { freq: 'daily', until: '2026-12-01' }), ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
  assert.deepEqual(repeatDates('2026-11-24', { freq: 'weekly', until: '2026-12-15' }), ['2026-11-24', '2026-12-01', '2026-12-08', '2026-12-15']);
});
test('monthly keeps the day, short months use the last day', () => {
  assert.deepEqual(repeatDates('2026-01-31', { freq: 'monthly', until: '2026-05-31' }), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  assert.deepEqual(repeatDates('2026-11-15', { freq: 'monthly', until: '2027-02-14' }), ['2026-11-15', '2026-12-15', '2027-01-15']);
});
test('certain weekdays (0 = Sunday)', () => {
  const d = repeatDates('2026-11-21', { freq: 'days', weekdays: [6, 0, 2], until: '2026-11-30' });   /* Sat 21 Nov 2026 */
  assert.deepEqual(d, ['2026-11-21', '2026-11-22', '2026-11-24', '2026-11-28', '2026-11-29']);
  assert.deepEqual(repeatDates('2026-11-21', { freq: 'days', weekdays: [], until: '2026-11-30' }), []);
});
test('bad input and the limit', () => {
  assert.deepEqual(repeatDates('2026-11-21', { freq: 'daily', until: '2026-11-20' }), []); assert.deepEqual(repeatDates('x', { freq: 'daily', until: '2026-11-20' }), []);
  assert.equal(repeatDates('2026-01-01', { freq: 'daily', until: '2030-01-01' }).length, REPEAT_MAX + 1);   /* one over the limit, so the caller can refuse */
});
test('occurrences keep the length of the task', () => {
  assert.deepEqual(occurrences('2026-11-24', '2026-11-26', { freq: 'weekly', until: '2026-12-01' }), [{ start: '2026-11-24', due: '2026-11-26' }, { start: '2026-12-01', due: '2026-12-03' }]);
  assert.deepEqual(occurrences(null, '2026-11-24', { freq: 'daily', until: '2026-11-25' }), [{ start: null, due: '2026-11-24' }, { start: null, due: '2026-11-25' }]);
  assert.deepEqual(occurrences('2026-11-24', null, { freq: 'daily', until: '2026-11-24' }), [{ start: '2026-11-24', due: null }]); assert.deepEqual(occurrences(null, null, { freq: 'daily', until: '2026-11-24' }), []);
});
