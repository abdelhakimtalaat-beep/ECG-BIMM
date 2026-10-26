// Minimal iCalendar (RFC 5545) builder for all-day invitations (pure; unit tested).
export interface IcsInput {
  uid: string; seq: number; method: 'REQUEST' | 'CANCEL'; summary: string; description?: string;
  start: string; end?: string | null;            // YYYY-MM-DD, inclusive; end defaults to start
  organizerEmail: string; organizerName?: string; attendeeEmail: string; attendeeName?: string;
  busy?: boolean; now?: Date;
}
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\;').replace(/,/g, '\\,');
const d8 = (d: string) => d.replace(/-/g, '');
export const nextDay = (d: string) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
const stamp = (n: Date) => n.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line: string) { // 75 octets per line, continuation lines start with a space
  const out: string[] = []; let cur = '';
  for (const ch of line) { if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ''; } cur += ch; }
  out.push(cur); return out.join('\r\n ');
}
export function buildIcs(i: IcsInput): string {
  const end = nextDay(i.end && i.end >= i.start ? i.end : i.start);
  const cn = (n?: string) => (n ? `;CN="${n.replace(/["\r\n]/g, '')}"` : '');
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ECG//BIM Portal//EN', 'CALSCALE:GREGORIAN', `METHOD:${i.method}`,
    'BEGIN:VEVENT', `UID:${i.uid}`, `SEQUENCE:${i.seq}`, `DTSTAMP:${stamp(i.now ?? new Date())}`,
    `DTSTART;VALUE=DATE:${d8(i.start)}`, `DTEND;VALUE=DATE:${d8(end)}`,
    `SUMMARY:${esc(i.summary)}`, ...(i.description ? [`DESCRIPTION:${esc(i.description)}`] : []),
    `ORGANIZER${cn(i.organizerName)}:mailto:${i.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE${cn(i.attendeeName)}:mailto:${i.attendeeEmail}`,
    `STATUS:${i.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`, `TRANSP:${i.busy ? 'OPAQUE' : 'TRANSPARENT'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return L.map(fold).join('\r\n') + '\r\n';
}
