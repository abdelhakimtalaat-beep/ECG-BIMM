import test from 'node:test';
import assert from 'node:assert/strict';
import * as i from '../lib/importer.ts';

test('area parsing keeps only valid numbers', () => {
  assert.deepEqual(i.parseArea(291069), { value: 291069, note: null });
  assert.equal(i.parseArea('12 815 ').value, 12815);
  assert.equal(i.parseArea('26347 ').value, 26347);
  assert.equal(i.parseArea('2000 per site ( 5 Sites)').value, null);
  assert.equal(i.parseArea('51,000 for Hotel').value, null);
  assert.equal(i.parseArea('Special case').value, null);
  assert.equal(i.parseArea(null).value, null);
});
test('coordinator cells with two people are split', () => {
  assert.deepEqual(i.splitPeople('Abdelrahman Radwan and Mahitab Yosri'), ['Abdelrahman Radwan', 'Mahitab Yosri']);
  assert.deepEqual(i.splitPeople('Hagar Abelala and Mais Talaat '), ['Hagar Abelala', 'Mais Talaat']);
  assert.deepEqual(i.splitPeople('Moataz Belal/Amal'), ['Moataz Belal', 'Amal']);
  assert.deepEqual(i.splitPeople(null), []);
});
test('headers are auto-mapped by name', () => {
  const m = i.autoMap(['BIM Manager', 'BIM Coordinator', 'Project No.', 'Project Name', 'CDE', 'Type', 'Built-Up Area', 'Status', null]);
  assert.deepEqual([m.manager, m.coordinator, m.project_no, m.name, m.cde, m.type, m.area, m.status, m.activity], [0, 1, 2, 3, 4, 5, 6, 7, null]);
});
test('people resolve by name, id or alias', () => {
  const emps = [{ id: '1', name: 'Hagar Aboelala', employee_code: 'D574' }, { id: '2', name: 'Nesrin Mahmoud', employee_code: 'C147' }];
  const aliases = [{ alias: 'Hagar Abelala', employee_id: '1' }];
  assert.equal(i.resolvePerson('hagar  aboelala', emps, aliases), '1');
  assert.equal(i.resolvePerson('Hagar Abelala', emps, aliases), '1');
  assert.equal(i.resolvePerson('C147', emps, aliases), '2');
  assert.equal(i.resolvePerson('Nobody', emps, aliases), null);
});
test('csv parsing handles quotes and commas', () => {
  assert.deepEqual(i.csvToRows('a,"b,c",d\n1,"x ""q""",3\n'), [['a', 'b,c', 'd'], ['1', 'x "q"', '3']]);
  assert.equal(i.csvEscape('a,b'), '"a,b"');
});
test('activity flag normalisation', () => {
  assert.equal(i.normFlag('NOT Active'), 'Not Active');
  assert.equal(i.normFlag('Active '), 'Active');
  assert.equal(i.normFlag(null), '');
});
