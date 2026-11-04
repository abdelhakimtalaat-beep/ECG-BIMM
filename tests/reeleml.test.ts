import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReelEml, reelMailContent } from '../lib/reelEml.ts';
test('reel eml', () => {
  const c = reelMailContent({ topic: 'Comparing Model Versions in Revit', speaker: 'Fatma Idris', whenText: 'Today, 10:00 AM', link: 'https://teams.microsoft.com/meet/1?p=a&b' });
  assert.match(c.subject, /^BIM Reels: Comparing Model Versions in Revit/);
  assert.ok(c.html.includes('<a href="https://teams.microsoft.com/meet/1?p=a&amp;b"><img src="cid:reel-announcement"'));
  assert.ok(c.text.includes('Meeting link: https://teams'));
  const eml = buildReelEml({ ...c, png: new Uint8Array([137, 80, 78, 71]) });
  assert.ok(eml.startsWith('X-Unsent: 1\r\n')); assert.match(eml, /Content-ID: <reel-announcement>/); assert.match(eml, /iVBORw|iVBO/);
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(eml)); // the en dash in the subject is encoded
  const none = reelMailContent({ topic: '', speaker: 'X', whenText: 'w' }); assert.ok(!none.html.includes('<a '));
});
