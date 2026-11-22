import { z } from 'zod';
import { handle, json, ok } from '@/lib/api';
import { ApiError, recordFail, throttle } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { getGuestCfg } from '@/lib/guestServer';
import { emailAllowed, hashCode, newCode, normalizeEmail, OTP_MINUTES } from '@/lib/guest';
import { mailEnabled, sendMail } from '@/lib/mailer';

/** Public: e-mails a 6-digit one-time code (valid 10 minutes) to someone who wants general (read-only) access. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = z.object({ email: z.string().max(200) }).parse(await json(req)); const cfg = await getGuestCfg();
    if (!cfg.enabled) throw new ApiError(403, 'General access is not switched on');
    const email = normalizeEmail(b.email); if (!email) throw new ApiError(400, 'Enter a valid e-mail address');
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'; throttle('otp-ip:' + ip); recordFail('otp-ip:' + ip);   /* every request counts: 8 per 15 minutes per address */
    if (!emailAllowed(email, cfg.domains)) throw new ApiError(403, `Only e-mail addresses of ${cfg.domains.map((d) => '@' + d).join(', ')} can use general access`);
    const staff = await one<{ is_guest: boolean }>('select is_guest from users where lower(email)=$1', [email]);
    if (staff && !staff.is_guest) throw new ApiError(400, 'This e-mail has a portal account. Please sign in with your password.');
    if (staff && staff.is_guest && !(await one('select 1 from users where lower(email)=$1 and active', [email]))) throw new ApiError(403, 'This e-mail is blocked');
    const recent = await q<{ created_at: string }>(`select created_at from otp_codes where email=$1 and created_at > now() - interval '1 hour' order by created_at desc`, [email]);
    if (recent.length >= 5) throw new ApiError(429, 'Too many codes were requested for this e-mail. Try again in an hour.');
    if (recent[0] && Date.now() - Date.parse(recent[0].created_at) < 60_000) throw new ApiError(429, 'A code was just sent. Wait a minute before asking for another one.');
    if (!mailEnabled()) throw new ApiError(503, 'E-mail sending is not configured, so a code cannot be sent');
    const code = newCode(); const secret = process.env.SESSION_SECRET ?? '';
    await q(`update otp_codes set used=true where email=$1 and not used`, [email]);
    await q(`insert into otp_codes(email,code_hash,expires_at,ip) values($1,$2,now() + interval '${OTP_MINUTES} minutes',$3)`, [email, hashCode(secret, email, code), ip]);
    try { await sendMail({ to: email, subject: `ECG BIM Portal verification code: ${code}`, text: `Your ECG BIM Portal verification code is ${code}\n\nIt is valid for ${OTP_MINUTES} minutes. It gives read-only access to the pages the BIM Department chose to share.\n\nIf you did not ask for this code, ignore this e-mail.\n\nECG BIM Department` }); }
    catch { throw new ApiError(502, 'The code could not be e-mailed. Please try again later.'); }
    return ok({ sent: true, minutes: OTP_MINUTES });
  });
}
