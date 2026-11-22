import test from 'node:test';
import assert from 'node:assert/strict';
import { emailAllowed, guestApiAllowed, hashCode, newCode, normalizeEmail, parseDomains, sameHash } from '../lib/guest.ts';

test('email and domain rules', () => {
  assert.equal(normalizeEmail('  Ali.Hassan@ECGSA.com '), 'ali.hassan@ecgsa.com'); assert.equal(normalizeEmail('bad'), null); assert.equal(normalizeEmail('a@b'), null); assert.equal(normalizeEmail('a b@c.com'), null);
  assert.deepEqual(parseDomains('ECGSA.com\n@dorsch.com, ecgsa.com'), ['ecgsa.com', 'dorsch.com']); assert.deepEqual(parseDomains('nonsense'), []);
  assert.equal(emailAllowed('a@ecgsa.com', ['ecgsa.com']), true); assert.equal(emailAllowed('a@evilecgsa.com', ['ecgsa.com']), false); assert.equal(emailAllowed('a@sub.ecgsa.com', ['ecgsa.com']), false); assert.equal(emailAllowed('a@x.org', []), true);
});
test('one-time codes', () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^\d{6}$/);
  const h = hashCode('s', 'a@b.co', '123456'); assert.equal(sameHash(h, hashCode('s', 'a@b.co', '123456')), true); assert.equal(sameHash(h, hashCode('s', 'a@b.co', '123457')), false); assert.equal(sameHash(h, hashCode('s', 'x@b.co', '123456')), false);
});
test('a guest may only read what the enabled tabs need', () => {
  const t = ['/projects', '/acc-stats'];
  assert.equal(guestApiAllowed('GET', '/api/data', []), true); assert.equal(guestApiAllowed('GET', '/api/auth/me', []), true); assert.equal(guestApiAllowed('POST', '/api/auth/logout', []), true);
  assert.equal(guestApiAllowed('GET', '/api/projects', t), true); assert.equal(guestApiAllowed('GET', '/api/acc/assignees', t), true); assert.equal(guestApiAllowed('GET', '/api/projects/abc/photo', t), true);
  assert.equal(guestApiAllowed('GET', '/api/projects', []), false);                       // no tab enabled
  assert.equal(guestApiAllowed('GET', '/api/vacations', t), false); assert.equal(guestApiAllowed('GET', '/api/tasks', t), false);   // tab not enabled
  assert.equal(guestApiAllowed('POST', '/api/projects', t), false); assert.equal(guestApiAllowed('PUT', '/api/projects/abc', t), false); assert.equal(guestApiAllowed('DELETE', '/api/projects/abc', t), false);
  for (const p of ['/api/users', '/api/audit', '/api/settings', '/api/import/commit', '/api/export/projects', '/api/employees/1/hr', '/api/employees/1/cv', '/api/employees/1/documents', '/api/acc/status', '/api/guest-access', '/api/photo-original', '/api/unknown']) assert.equal(guestApiAllowed('GET', p, ['/projects', '/org', '/acc-stats', '/contacts', '/teams']), false, p);
  assert.equal(guestApiAllowed('GET', '/api/employees', ['/org']), true); assert.equal(guestApiAllowed('GET', '/api/employees', ['/projects']), false);
  assert.equal(guestApiAllowed(null, '/api/data', t), false); assert.equal(guestApiAllowed('GET', null, t), false);   // fails closed without the request details
});
