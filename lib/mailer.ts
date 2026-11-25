// Tiny SMTP client (implicit TLS, AUTH PLAIN) so no extra package is needed. Works with a Gmail "app password".
// Configure with env vars SMTP_USER and SMTP_PASS (optional: SMTP_HOST, SMTP_PORT, SMTP_FROM_NAME, SMTP_FROM_EMAIL = the address shown to the reader; it must be allowed by the mail server). Without them mail is switched off.
import tls from 'node:tls';
import type { Duplex } from 'node:stream';

export interface Mail { to: string; subject: string; text: string; ics?: { method: 'REQUEST' | 'CANCEL'; content: string }; attachments?: { filename: string; mime: string; data: Buffer }[] }
export interface MailOpts { connect?: () => Duplex; user?: string; pass?: string; fromName?: string; timeoutMs?: number }
export const mailEnabled = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
const wrap = (s: string) => s.replace(/(.{76})/g, '$1\r\n');
const hdr = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ');

export function buildMessage(from: { email: string; name: string }, m: Mail): string {
  const bd = 'ecg-' + Math.random().toString(36).slice(2);
  const head = [`From: ${hdr(clean(from.name))} <${from.email}>`, `To: ${m.to}`, `Subject: ${hdr(clean(m.subject))}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0'];
  const text = `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(b64(m.text))}`;
  if (m.attachments?.length) {   /* text + files (e.g. a screenshot with an answer) */
    const parts = m.attachments.map((a) => `--${bd}\r\nContent-Type: ${a.mime.replace(/[\r\n;]/g, '')}; name="${hdr(clean(a.filename))}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${hdr(clean(a.filename))}"\r\n\r\n${wrap(b64(a.data))}`);
    return [...head, `Content-Type: multipart/mixed; boundary="${bd}"`, '', `--${bd}`, text, ...parts, `--${bd}--`, ''].join('\r\n');
  }
  if (!m.ics) return head.join('\r\n') + '\r\n' + text + '\r\n';
  return [...head, `Content-Type: multipart/alternative; boundary="${bd}"`, '', `--${bd}`, text, `--${bd}`,
    `Content-Type: text/calendar; charset=UTF-8; method=${m.ics.method}`, 'Content-Transfer-Encoding: base64', '', wrap(b64(m.ics.content)), `--${bd}--`, ''].join('\r\n');
}

export async function sendMail(m: Mail, o: MailOpts = {}): Promise<void> {
  const user = o.user ?? process.env.SMTP_USER, pass = o.pass ?? process.env.SMTP_PASS;
  if (!user || !pass) throw new Error('Mail is not configured');
  const from = { email: process.env.SMTP_FROM_EMAIL?.trim() || user, name: o.fromName ?? process.env.SMTP_FROM_NAME ?? 'ECG BIM Portal' };
  const raw = buildMessage(from, m).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
  const sock = o.connect ? o.connect() : tls.connect({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, servername: process.env.SMTP_HOST || 'smtp.gmail.com' });
  await new Promise<void>((resolve, reject) => {
    const steps: [string | null, number][] = [
      [null, 220], ['EHLO ecg-bim-portal', 250], [`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, 235],
      [`MAIL FROM:<${user}>`, 250], [`RCPT TO:<${m.to}>`, 250], ['DATA', 354], [`${raw}\r\n.`, 250], ['QUIT', 221],
    ];
    let i = 0, buf = '';
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('SMTP timeout')); }, o.timeoutMs ?? 8000);
    const done = (e?: Error) => { clearTimeout(timer); sock.destroy(); e ? reject(e) : resolve(); };
    sock.on('error', done);
    sock.on('data', (d) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 2);
        if (/^\d{3}-/.test(line)) continue;                       // multi-line reply, wait for the last line
        const code = Number(line.slice(0, 3));
        if (code !== steps[i][1]) return done(new Error(`SMTP ${line.slice(0, 120)}`));
        i++;
        if (i >= steps.length) return done();
        sock.write(steps[i][0] + '\r\n');
      }
    });
  });
}
