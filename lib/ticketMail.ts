// Sends the e-mails of the troubleshooting workflow. Never blocks or fails the request.
import { one, q } from './db';
import { sendMail } from './mailer';
import { safe, type MailResult } from './notify';
import { getReviewerIds } from './ticketAccess';
import { ticketMessage, type TicketMail } from './tickets';

const link = () => { const u = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''); return u ? u.replace(/\/$/, '') + '/troubleshooting' : null; };
type Row = { ticket_no: number; title: string; project_name: string; software: string; priority: string; problem?: string; ticket_type?: string };
export const adminsOf = () => q<{ id: string; email: string; full_name: string | null }>(`select id,email,full_name from users where role='admin' and active and not coalesce(is_guest,false)`).catch(() => q<{ id: string; email: string; full_name: string | null }>(`select id,email,full_name from users where role='admin' and active`));
/** One e-mail to one person (optionally with the answer image attached). */
export const mailTicket = (to: { email: string; name: string } | null, t: Row, m: TicketMail, image?: { filename: string; mime: string; data: Buffer } | null): Promise<MailResult> => safe(async () => {
  if (!to?.email) return false; const x = ticketMessage(t, m, to.name, link());
  await sendMail({ to: to.email, subject: x.subject, text: x.text, attachments: image ? [image] : undefined }); return true;
});
/** The same e-mail to every Administrator except the person who did the action. */
export const mailAdmins = async (t: Row, m: TicketMail, exceptId?: string): Promise<MailResult> => {
  const res = await Promise.all((await adminsOf()).filter((a) => a.id !== exceptId).map((a) => mailTicket({ email: a.email, name: a.full_name || a.email.split('@')[0] }, t, m)));
  return res.includes('sent') ? 'sent' : res.includes('failed') ? 'failed' : res.includes('off') ? 'off' : 'skipped';
};
/** An answer waiting for review goes to the Administrators and to the reviewers the Administrator added. */
export const mailReviewers = async (t: Row, m: TicketMail, exceptId?: string): Promise<MailResult> => {
  const ids = await getReviewerIds(); const extra = ids.length ? await q<{ id: string; email: string; full_name: string | null }>(`select id,email,full_name from users where id = any($1::uuid[]) and active`, [ids]) : [];
  const all = new Map([...(await adminsOf()), ...extra].map((u) => [u.id, u]));
  const res = await Promise.all([...all.values()].filter((a) => a.id !== exceptId).map((a) => mailTicket({ email: a.email, name: a.full_name || a.email.split('@')[0] }, t, m)));
  return res.includes('sent') ? 'sent' : res.includes('failed') ? 'failed' : res.includes('off') ? 'off' : 'skipped';
};
export const loadImage = async (id: string | null) => { if (!id) return null; const a = await one<{ filename: string; mime: string; data: Buffer }>('select filename,mime,data from attachments where id=$1', [id]); return a ? { filename: a.filename || 'image', mime: a.mime, data: a.data } : null; };
