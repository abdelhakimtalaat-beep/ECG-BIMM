import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutWeek, monthWeeks, shiftMonth, taskSpan, tasksOnDay, WEEKDAYS } from '../lib/taskCalendar.ts';
const T = (id: string, s: string | null, e: string | null) => ({ id, title: id, start_date: s, due_date: e });
test('weeks start on Saturday', () => {
  const w = monthWeeks(2026, 11); assert.equal(w.length, 5); assert.equal(w[0][0], '2026-10-31'); assert.equal(w[0][1], '2026-11-01'); assert.equal(w[4][6], '2026-12-04'); assert.equal(WEEKDAYS[0], 'Sat');
  for (const wk of w) assert.equal(new Date(wk[0] + 'T00:00:00Z').getUTCDay(), 6);
  assert.equal(monthWeeks(2026, 8)[0][0], '2026-08-01');   /* 1 Aug 2026 is a Saturday */
  assert.equal(monthWeeks(2027, 2)[0][0], '2027-01-30');
});
test('month shift', () => { assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 }); assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 }); });
test('task span', () => {
  assert.deepEqual(taskSpan(T('a', '2026-11-03', '2026-11-05')), { start: '2026-11-03', end: '2026-11-05' }); assert.deepEqual(taskSpan(T('a', null, '2026-11-05')), { start: '2026-11-05', end: '2026-11-05' });
  assert.deepEqual(taskSpan(T('a', '2026-11-09', '2026-11-05')), { start: '2026-11-05', end: '2026-11-09' }); assert.equal(taskSpan(T('a', null, null)), null);
  assert.deepEqual(taskSpan(T('a', '2026-11-03T00:00:00.000Z', null)), { start: '2026-11-03', end: '2026-11-03' });
});
test('layout: lanes, spans over week edges and hidden tasks', () => {
  const week = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const l = layoutWeek(week, [T('long', '2026-11-01', '2026-11-20'), T('b', '2026-11-09', '2026-11-10'), T('c', '2026-11-09', '2026-11-09'), T('d', '2026-11-09', '2026-11-09'), T('none', null, null), T('out', '2026-12-01', '2026-12-02')], 3);
  const long = l.bars.find((b) => b.task.id === 'long')!; assert.deepEqual([long.col, long.span, long.lane, long.fromPrev, long.toNext], [0, 7, 0, true, true]);
  assert.equal(l.bars.length, 3); assert.equal(l.hidden[2], 1); assert.equal(l.hidden.reduce((a, b) => a + b, 0), 1); assert.equal(l.lanes, 3);
  assert.equal(layoutWeek(week, [], 3).lanes, 1);
});
test('tasks on a day', () => { const ts = [T('a', '2026-11-03', '2026-11-05'), T('b', null, '2026-11-04'), T('c', null, null)]; assert.deepEqual(tasksOnDay(ts, '2026-11-04').map((t) => t.id), ['a', 'b']); assert.equal(tasksOnDay(ts, '2026-11-06').length, 0); });
