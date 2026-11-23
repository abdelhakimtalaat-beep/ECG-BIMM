import test from 'node:test';
import assert from 'node:assert/strict';
import { locationItems } from '../lib/accLocations.ts';
const nodes = [
  { id: 'r', parentId: null, type: 'Root', name: 'Project' },
  { id: 'b2', parentId: 'r', type: 'Area', name: 'Building 10', order: 2 }, { id: 'b1', parentId: 'r', type: 'Area', name: 'Building 2', order: 1 },
  { id: 'f1', parentId: 'b1', type: 'Level', name: 'Level 1', order: 1 }, { id: 'f2', parentId: 'b1', type: 'Level', name: 'Level 2', order: 2 }, { id: 'g1', parentId: 'b2', type: 'Level', name: 'Ground', order: 1 },
  { id: 'x', parentId: 'f1', type: 'Area', name: 'Flat 101', order: 1 }, { id: 'b1', parentId: 'r', type: 'Area', name: 'duplicate', order: 9 },
];
test('first level only', () => {
  const l = locationItems(nodes, 1); assert.deepEqual(l.map((x) => x.name), ['Building 2', 'Building 10']); assert.ok(l.every((x) => x.depth === 1 && x.parent === null));
});
test('two levels', () => {
  const l = locationItems(nodes, 2); assert.deepEqual(l.map((x) => x.name), ['Building 2', 'Building 2 - Level 1', 'Building 2 - Level 2', 'Building 10', 'Building 10 - Ground']);
  assert.equal(l[1].depth, 2); assert.equal(l[1].parent, 'Building 2'); assert.ok(!l.some((x) => x.name.includes('Flat')));
});
test('empty and root-less trees', () => {
  assert.deepEqual(locationItems([], 1), []); assert.deepEqual(locationItems([{ id: 'a', parentId: null, name: 'Only root' }], 2), []);
  assert.equal(locationItems([{ id: 'a', parentId: null, name: 'R' }, { id: 'b', parentId: 'a', name: '  ' }], 1).length, 0);
});
