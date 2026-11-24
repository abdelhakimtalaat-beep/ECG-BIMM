// E-mail to the person who proposed an idea when somebody else (the Administrator) acts on it. Never blocks or fails the request.
import { one } from './db';
import { sendMail } from './mailer';
import { safe, type MailResult } from './notify';
import { wishMessage, type WishAction } from './wishText';
export type { WishAction } from './wishText';

export interface WishChange { title: string; status: string; admin_note: string | null; author_id: string | null }
const url = () => { const u = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''); return u ? u.replace(/\/$/, '') + '/wishes' : null; };
/** Tells the author. Nothing is sent when the author did it himself, has no account e-mail, or mail is switched off. */
export const mailWishAuthor = (w: WishChange, a: WishAction, by: { id: string; name: string }): Promise<MailResult> => safe(async () => {
  if (!w.author_id || w.author_id === by.id) return false;
  const u = await one<{ email: string; full_name: string | null }>('select email, full_name from users where id=$1', [w.author_id]); if (!u?.email) return false;
  const m = wishMessage(w, a, by.name, a.kind === 'deleted' ? null : url(), u.full_name || u.email.split('@')[0]);
  await sendMail({ to: u.email, subject: m.subject, text: m.lines.join('\n') }); return true;
});
