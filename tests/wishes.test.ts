import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditWish, canManageWish, sortWishes, WISH_STATUSES } from '../lib/wishes.ts';

test('who edits an idea', () => {
  assert.equal(canEditWish('admin', 'u9', { author_id: 'u1', status: 'Done' }), true);
  assert.equal(canEditWish('viewer', 'u1', { author_id: 'u1', status: 'New' }), true);
  assert.equal(canEditWish('viewer', 'u1', { author_id: 'u1', status: 'Planned' }), false);
  assert.equal(canEditWish('bim_manager', 'u2', { author_id: 'u1', status: 'New' }), false);
  assert.equal(canManageWish('admin'), true); assert.equal(canManageWish('bim_manager'), false);
  assert.ok(WISH_STATUSES.includes('Declined'));
});
test('sorting', () => {
  const r = [{ votes: 1, created_at: '2026-10-01' }, { votes: 3, created_at: '2026-09-01' }, { votes: 3, created_at: '2026-10-05' }];
  assert.deepEqual(sortWishes(r, 'votes').map((x) => x.created_at), ['2026-10-05', '2026-09-01', '2026-10-01']);
  assert.equal(sortWishes(r, 'newest')[0].created_at, '2026-10-05');
});
