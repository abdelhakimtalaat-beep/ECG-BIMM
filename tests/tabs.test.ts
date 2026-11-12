import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeTab, firstAllowedTab, isTabRestricted, tabOfPath, TAB_LIST } from '../lib/tabs.ts';
test('tabs', () => {
  assert.equal(canSeeTab({ role: 'viewer', allowed_tabs: null }, '/org'), true);
  const v = { role: 'viewer', allowed_tabs: ['/projects', '/meetings'] };
  assert.ok(isTabRestricted(v)); assert.equal(canSeeTab(v, '/projects'), true); assert.equal(canSeeTab(v, '/contacts'), false);
  assert.equal(canSeeTab({ role: 'admin', allowed_tabs: ['/projects'] }, '/contacts'), true);
  assert.equal(firstAllowedTab(v), '/projects'); assert.equal(firstAllowedTab({ role: 'viewer', allowed_tabs: [] }), null);
  assert.equal(tabOfPath('/projects/abc'), '/projects'); assert.equal(tabOfPath('/process-map'), '/process-map'); assert.equal(tabOfPath('/'), '/'); assert.equal(tabOfPath('/admin'), null);
  assert.equal(TAB_LIST.length, 14);
});
