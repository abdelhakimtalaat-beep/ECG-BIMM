import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, birthdayIn, birthdaysFrom } from '../lib/birthday.ts';
const P = (id: string, birth: string | null) => ({ id, name: id, birth_date: birth });
test('birthdays', () => {
  const r = birthdaysFrom([P('a', '1985-11-08'), P('b', '1990-11-10'), P('c', '1991-12-30'), P('d', null), P('e', '1980-11-07')], '2026-11-08', 7);
  assert.deepEqual(r.map((x) => [x.id, x.days, x.turning]), [['a', 0, 41], ['b', 2, 36]]);
  assert.deepEqual(birthdaysFrom([P('a', '1985-11-08')], '2026-11-08').map((x) => x.id), ['a']); assert.equal(birthdaysFrom([P('b', '1990-11-10')], '2026-11-08').length, 0);
  assert.deepEqual(birthdaysFrom([P('c', '1991-01-02')], '2026-12-29', 7).map((x) => [x.date, x.days, x.turning]), [['2027-01-02', 4, 36]]); // across the new year
  assert.equal(birthdayIn('2000-02-29', 2027), '2027-02-28'); assert.equal(birthdayIn('2000-02-29', 2028), '2028-02-29'); assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(birthdaysFrom([P('l', '2000-02-29')], '2027-02-28').length, 1);
});
