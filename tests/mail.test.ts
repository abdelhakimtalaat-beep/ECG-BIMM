import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { buildIcs, nextDay } from '../lib/ics.ts';
import { buildMessage, sendMail } from '../lib/mailer.ts';

test('ics: all-day event, exclusive end, cancel, escaping and folding', () => {
  const base = { uid: 'task-1@x', seq: 5, summary: 'A, B; C', description: 'line1\nline2', start: '2026-10-30', end: '2026-11-02', organizerEmail: 'o@x.com', organizerName: 'Org', attendeeEmail: 'a@ecgsa.com', attendeeName: 'Amal', now: new Date('2026-10-26T10:00:00Z') };
  const r = buildIcs({ ...base, method: 'REQUEST' });
  assert.match(r, /METHOD:REQUEST/); assert.match(r, /DTSTART;VALUE=DATE:20261030/); assert.match(r, /DTEND;VALUE=DATE:20261103/);
  assert.match(r, /SUMMARY:A\\, B\; C/); assert.match(r, /DESCRIPTION:line1\\nline2/); assert.match(r, /STATUS:CONFIRMED/); assert.match(r, /DTSTAMP:20261026T100000Z/);
  assert.match(buildIcs({ ...base, method: 'CANCEL' }), /STATUS:CANCELLED/);
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
  assert.ok(buildIcs({ ...base, method: 'REQUEST', description: 'x'.repeat(300) }).split('\r\n').every((l) => Buffer.byteLength(l) <= 76));
});
test('mail message carries the calendar part', () => {
  const m = buildMessage({ email: 'o@x.com', name: 'ECG' }, { to: 'a@b.com', subject: 'Tâsk', text: 'hi', ics: { method: 'REQUEST', content: 'BEGIN:VCALENDAR\r\n' } });
  assert.match(m, /Content-Type: multipart\/alternative/); assert.match(m, /text\/calendar; charset=UTF-8; method=REQUEST/); assert.match(m, /Subject: =\?UTF-8\?B\?/);
});
test('SMTP client talks to a (fake) server correctly', async () => {
  const got: string[] = []; let data = false; let body = '';
  const srv = net.createServer((s) => {
    s.write('220 hi\r\n'); let buf = '';
    s.on('data', (d) => { buf += d.toString(); let i; while ((i = buf.indexOf('\r\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2);
      if (data) { if (l === '.') { data = false; s.write('250 queued\r\n'); } else body += l + '\n'; continue; }
      got.push(l.split(' ')[0] + (l.startsWith('MAIL') || l.startsWith('RCPT') ? ' ' + l.slice(l.indexOf(':') + 1) : ''));
      if (l.startsWith('EHLO')) s.write('250-x\r\n250 AUTH PLAIN\r\n'); else if (l.startsWith('AUTH')) s.write('235 ok\r\n'); else if (l.startsWith('MAIL') || l.startsWith('RCPT')) s.write('250 ok\r\n');
      else if (l === 'DATA') { data = true; s.write('354 go\r\n'); } else if (l === 'QUIT') { s.write('221 bye\r\n'); s.end(); } } });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as net.AddressInfo).port;
  await sendMail({ to: 'amal@ecgsa.com', subject: 'Hello', text: 'x\n.\ny' }, { user: 'me@gmail.com', pass: 'pw', connect: () => net.connect(port, '127.0.0.1') });
  srv.close();
  assert.deepEqual(got, ['EHLO', 'AUTH', 'MAIL <me@gmail.com>', 'RCPT <amal@ecgsa.com>', 'DATA', 'QUIT']);
  assert.match(body, /Subject: Hello/);
  await assert.rejects(() => sendMail({ to: 'a@b.com', subject: 's', text: 't' }, { user: 'u', pass: 'p', connect: () => { const s = net.connect(port, '127.0.0.1'); return s; }, timeoutMs: 500 }));
});
