import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCsv, readZip, summarize, lastMonths, summarizeZip } from '../lib/accStats.ts';

function zipOf(files: Record<string, string>, deflate = false): Buffer {
  const parts: Buffer[] = [], dir: Buffer[] = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = deflate ? deflateRawSync(raw) : raw, nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, data); dir.push(ch, nm); off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(dir), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(dir.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}
test('csv parser handles quotes, commas, line breaks and a BOM', () => {
  const r = parseCsv('﻿a,b,c\r\n1,"x, y","line1\nline2"\r\n2,"say ""hi""",\r\n');
  assert.equal(r.length, 2); assert.equal(r[0].b, 'x, y'); assert.equal(r[0].c, 'line1\nline2'); assert.equal(r[1].b, 'say "hi"'); assert.equal(r[1].c, '');
});
test('zip reader: stored and deflated entries, and a filter', () => {
  for (const d of [false, true]) { const z = readZip(zipOf({ 'a.csv': 'x,y\n1,2\n', 'dir/b.csv': 'q\n9\n', 'skip.csv': 'no' }, d), (n) => n !== 'skip.csv'); assert.deepEqual(Object.keys(z), ['a.csv', 'dir/b.csv']); assert.equal(z['a.csv'].toString(), 'x,y\n1,2\n'); }
  assert.throws(() => readZip(Buffer.from('not a zip at all, really not')));
});
const files = {
  'admin_projects.csv': 'id,name\nP1,3574-Hacienda\nP2,Other\n',
  'issues_issue_types.csv': 'issue_type_id,issue_type\nT1,Coordination\nT2,Quality\n',
  'issues_root_causes.csv': 'root_cause_id,title\nR1,Human error\n',
  'admin_project_roles.csv': 'role_oxygen_id,name\n77,ECG_E Group\n', 'admin_users.csv': 'id,autodesk_id,name\nu1,AUT1,Sara\n',
  'issues_issues.csv': ['issue_id,bim360_project_id,type_id,status,root_cause_id,due_date,created_at,closed_at,deleted_at,assignee_id,assignee_type',
    'a,P1,T1,open,R1,2026-11-01,2026-11-02 10:00:00,,,77,role', 'b,P1,T1,closed,,,2026-10-01 00:00:00,2026-10-11 00:00:00,,77,role', 'c,P1,T2,open,,2027-01-01,2026-11-10 00:00:00,,,AUT1,user', 'd,P1,T2,closed,,,2026-10-01 00:00:00,2026-10-02 00:00:00,2026-10-03,77,role', 'e,P2,T1,draft,,,2026-11-01 00:00:00,,,'].join('\n'),
  'reviews_reviews.csv': 'id,bim360_project_id,status,is_archived\nv1,P1,open,f\nv2,P1,closed,f\nv3,P1,void,t\n',
  'reviews_review_tasks.csv': 'review_id,bim360_project_id,state\nv1,P1,unclaimed\nv1,P1,claimed\nv2,P1,unclaimed\nv1,P1,void\n',
  'clashes_clash_test.csv': 'bim360_project_id,status\nP1,Successful\nP1,Failed\nP1,Successful\n',
};
test('summary per ACC project', () => {
  const s = summarize(files, '2026-11-16'); const p = s.find((x) => x.project_id === 'P1')!;
  assert.equal(p.name, '3574-Hacienda'); assert.equal(p.issues.total, 3);                                  // the deleted one is ignored
  assert.equal(p.issues.open, 2); assert.equal(p.issues.closed, 1); assert.equal(p.issues.avg_close_days, 10);
  assert.equal(p.issues.overdue, 1); assert.equal(p.issues.with_due_date, 2); assert.deepEqual(p.issues.by_type, [{ name: 'Coordination', count: 2 }, { name: 'Quality', count: 1 }]);
  assert.deepEqual(p.issues.by_root_cause, [{ name: 'Human error', count: 1 }]);
  assert.equal(p.issues.monthly.length, 12); assert.equal(p.issues.monthly[11].month, '2026-11'); assert.equal(p.issues.monthly[11].opened, 2); assert.equal(p.issues.monthly[10].closed, 1);
  assert.deepEqual(p.assignees.map((a) => [a.name, a.kind, a.total, a.by_status.open ?? 0]), [['ECG_E Group', 'role', 2, 1], ['Sara', 'user', 1, 1]]);
  assert.equal(p.reviews.total, 2); assert.equal(p.reviews.open_tasks, 2); assert.equal(p.reviews.unclaimed_tasks, 1);   // only tasks of running reviews
  assert.deepEqual(p.clashes.by_status, { Failed: 1, Successful: 2 }); assert.equal(s.find((x) => x.project_id === 'P2')!.issues.open, 1);
  assert.deepEqual(lastMonths('2026-02-10', 3), ['2025-12', '2026-01', '2026-02']);
});
test('summary from a zip', () => {
  const s = summarizeZip(zipOf(Object.fromEntries(Object.entries(files).map(([k, v]) => ['extract/' + k, v])), true), '2026-11-16'); assert.equal(s.length, 2);
});

import { readExtractZip } from '../lib/accZipBrowser.ts';
test('browser zip reader gives the same summary as the server reader', async () => {
  const z = zipOf(Object.fromEntries(Object.entries(files).map(([k, v]) => ['extract/' + k, v])), true);
  const ab = z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
  const got = await readExtractZip(ab); assert.deepEqual(summarize(got, '2026-11-16'), summarize(files, '2026-11-16'));
});
