import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, localToUtc } from '../lib/icsParse.ts';
import { cleanFeedUrl } from '../lib/calendarUrl.ts';

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
const D = (s: string) => Date.parse(s);
const W = [D('2026-11-01T00:00:00Z'), D('2027-01-31T00:00:00Z')] as const;

test('ics: single UTC event, text escapes, line folding, Teams link, organizer', () => {
  const ev = parseIcs(wrap(`BEGIN:VEVENT\r\nUID:a1\r\nDTSTART:20261104T090000Z\r\nDTEND:20261104T100000Z\r\nSUMMARY:Design review\\, phase 2\r\nLOCATION:Microsoft Teams Meeting\r\nDESCRIPTION:Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?\r\n context=x\r\nORGANIZER;CN="Ali Hassan":mailto:ali@ecg.com\r\nEND:VEVENT\r\n`), ...W);
  assert.equal(ev.length, 1); assert.equal(ev[0].title, 'Design review, phase 2'); assert.equal(ev[0].start, D('2026-11-04T09:00:00Z')); assert.equal(ev[0].end, D('2026-11-04T10:00:00Z'));
  assert.match(ev[0].teamsUrl!, /^https:\/\/teams\.microsoft\.com\/l\/meetup-join\//); assert.equal(ev[0].organizer, 'Ali Hassan');
});
test('ics: Outlook Windows time zone name (Egypt) incl. daylight saving', () => {
  const mk = (d: string) => parseIcs(wrap(`BEGIN:VEVENT\r\nUID:t\r\nDTSTART;TZID=Egypt Standard Time:${d}T100000\r\nDTEND;TZID=Egypt Standard Time:${d}T110000\r\nSUMMARY:x\r\nEND:VEVENT\r\n`), D('2026-01-01T00:00:00Z'), D('2027-01-01T00:00:00Z'))[0].start;
  assert.equal(mk('20260115'), D('2026-01-15T08:00:00Z')); // UTC+2 in winter
  assert.equal(mk('20260715'), D('2026-07-15T07:00:00Z')); // UTC+3 in summer (Egypt DST)
  assert.equal(localToUtc(2026, 1, 15, 10, 0, 0, 'Africa/Cairo'), D('2026-01-15T08:00:00Z'));
});
test('ics: weekly recurrence with BYDAY, EXDATE and a moved instance', () => {
  const ev = parseIcs(wrap(`BEGIN:VEVENT\r\nUID:w\r\nDTSTART;TZID=Africa/Cairo:20261102T100000\r\nDTEND;TZID=Africa/Cairo:20261102T103000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6\r\nEXDATE;TZID=Africa/Cairo:20261104T100000\r\nSUMMARY:Stand-up\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:w\r\nRECURRENCE-ID;TZID=Africa/Cairo:20261109T100000\r\nDTSTART;TZID=Africa/Cairo:20261109T140000\r\nDTEND;TZID=Africa/Cairo:20261109T143000\r\nSUMMARY:Stand-up (moved)\r\nEND:VEVENT\r\n`), ...W);
  // Mon 2, Wed 4 (excluded), Mon 9 (moved), Wed 11, Mon 16, Wed 18  => 5 instances
  assert.deepEqual(ev.map((e) => new Date(e.start).toISOString().slice(0, 16)), ['2026-11-02T08:00', '2026-11-09T12:00', '2026-11-11T08:00', '2026-11-16T08:00', '2026-11-18T08:00']);
  assert.equal(ev[1].title, 'Stand-up (moved)');
});
test('ics: weekly with interval 2, monthly 2nd Tuesday, UNTIL, all-day, cancelled', () => {
  const r = (rule: string, start = '20261103T080000Z') => parseIcs(wrap(`BEGIN:VEVENT\r\nUID:r\r\nDTSTART:${start}\r\nDTEND:${start.replace('080000', '090000')}\r\nRRULE:${rule}\r\nSUMMARY:r\r\nEND:VEVENT\r\n`), ...W).map((e) => new Date(e.start).toISOString().slice(0, 10));
  assert.deepEqual(r('FREQ=WEEKLY;INTERVAL=2;COUNT=3'), ['2026-11-03', '2026-11-17', '2026-12-01']);
  assert.deepEqual(r('FREQ=MONTHLY;BYDAY=2TU;COUNT=3', '20261110T080000Z'), ['2026-11-10', '2026-12-08', '2027-01-12']);
  assert.deepEqual(r('FREQ=DAILY;UNTIL=20261106T235959Z'), ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  const ad = parseIcs(wrap(`BEGIN:VEVENT\r\nUID:d\r\nDTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121\r\nSUMMARY:Holiday\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:c\r\nSTATUS:CANCELLED\r\nDTSTART:20261121T080000Z\r\nDTEND:20261121T090000Z\r\nSUMMARY:gone\r\nEND:VEVENT\r\n`), ...W);
  assert.equal(ad.length, 1); assert.ok(ad[0].allDay); assert.equal(ad[0].end - ad[0].start, 86400000);
});
test('ics: events outside the window are dropped; free / private flags', () => {
  const ev = parseIcs(wrap(`BEGIN:VEVENT\r\nUID:o\r\nDTSTART:20250101T080000Z\r\nDTEND:20250101T090000Z\r\nSUMMARY:old\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:p\r\nDTSTART:20261105T080000Z\r\nDTEND:20261105T090000Z\r\nCLASS:PRIVATE\r\nTRANSP:TRANSPARENT\r\nSUMMARY:doctor\r\nEND:VEVENT\r\n`), ...W);
  assert.equal(ev.length, 1); assert.ok(ev[0].isPrivate); assert.equal(ev[0].busy, false);
});

test('calendar link: only https Microsoft / Google calendar servers, ICS not HTML', () => {
  assert.equal(cleanFeedUrl(' webcal://outlook.office365.com/owa/calendar/a/b/reid/calendar.ics '), 'https://outlook.office365.com/owa/calendar/a/b/reid/calendar.ics');
  for (const bad of ['https://evil.com/a.ics', 'http://outlook.office365.com/a.ics', 'https://outlook.office365.com/owa/calendar/a/b/calendar.html', 'https://outlook.office365.com.evil.com/a.ics', 'https://attacker.com/outlook.office365.com', 'not a link']) assert.throws(() => cleanFeedUrl(bad), bad);
});
