import test from 'node:test';
import assert from 'node:assert/strict';
import { wishMessage } from '../lib/wishText.ts';
test('status change message', () => {
  const m = wishMessage({ title: 'Dark mode', admin_note: 'Planned for Q1' }, { kind: 'status', from: 'New', to: 'Planned' }, 'Abdelhakim', 'https://x/wishes', 'Sara');
  assert.equal(m.subject, 'Your idea "Dark mode" is now: Planned'); assert.ok(m.lines.join('\n').includes('from New to Planned')); assert.ok(m.lines.join('\n').includes('Planned for Q1')); assert.ok(m.lines.join('\n').includes('https://x/wishes')); assert.equal(m.lines[0], 'Hello Sara,');
});
test('reply, edit and delete messages', () => {
  assert.equal(wishMessage({ title: 'A', admin_note: 'Thanks' }, { kind: 'reply' }, 'Boss', null, 'S').subject, 'Reply to your idea "A"');
  assert.ok(wishMessage({ title: 'A', admin_note: null }, { kind: 'edited' }, 'Boss', null, 'S').subject.includes('updated'));
  const d = wishMessage({ title: 'A', admin_note: null }, { kind: 'deleted' }, 'Boss', null, 'S'); assert.ok(d.subject.includes('removed')); assert.ok(!d.lines.join('\n').includes('Wish List:'));
});
