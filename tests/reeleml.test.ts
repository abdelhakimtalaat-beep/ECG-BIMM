import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReelEml, DEFAULT_REEL_TO, reelMailContent, toAddresses } from '../lib/reelEml.ts';
test('reel eml', () => {
  const c = reelMailContent({ topic: 'Comparing Model Versions in Revit', when: 'today at 10:00 AM', link: 'https://teams.microsoft.com/meet/1?p=a&b' });
  assert.equal(c.subject, 'BIM Reel | Comparing Model Versions in Revit');
  assert.ok(c.text.startsWith('Dear All,\r\n\r\nThis is a gentle reminder about our BIM REEL online tutorial session scheduled for today at 10:00 AM.'));
  assert.ok(c.html.includes('font-size:12pt') && c.html.includes('<a href="https://teams.microsoft.com/meet/1?p=a&amp;b"><img src="cid:reel-announcement"'));
  const eml = buildReelEml({ ...c, to: 'a@x.com; b@x.com', png: new Uint8Array([137, 80, 78, 71]) });
  assert.ok(eml.startsWith('X-Unsent: 1\r\nTo: a@x.com; b@x.com\r\n')); assert.match(eml, /Content-ID: <reel-announcement>/); assert.match(eml, /iVBO/);
  assert.ok(/Subject: BIM Reel \| Comparing/.test(eml));
  assert.ok(!reelMailContent({ topic: '', when: 'w' }).html.includes('<a '));
});

test('default recipients', () => {
  const a = toAddresses(DEFAULT_REEL_TO); assert.equal(a.length, 17); assert.equal(a[0], 'Bimm_Dep@ecgsa.com'); assert.equal(a[2], 'landscapedep@ecgsa.com'); assert.equal(a.at(-1), 'ProjectManagers@ecgsa.com');
  assert.deepEqual(toAddresses('x@y.com;\n z@y.com; junk'), ['x@y.com', 'z@y.com']);
});
