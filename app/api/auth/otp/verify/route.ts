import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { handle, json, ok } from '@/lib/api';
import { ApiError, createSession, hash, recordFail, throttle } from '@/lib/auth';
import { audit, one, q } from '@/lib/db';
import { getGuestCfg } from '@/lib/guestServer';
import { hashCode, normalizeEmail, OTP_MAX_ATTEMPTS, sameHash } from '@/lib/guest';

/** Public: checks the one-time code and opens a read-only (general access) session. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = z.object({ email: z.string().max(200), code: z.string().max(12) }).parse(await json(req)); const cfg = await getGuestCfg();
    if (!cfg.enabled) throw new ApiError(403, 'General access is not switched on');
    const email = normalizeEmail(b.email); const code = b.code.replace(/\s/g, ''); if (!email || !/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code');
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'; const key = 'otp-verify:' + ip; throttle(key);
    const row = await one<{ id: string; code_hash: string; attempts: number }>(`select id,code_hash,attempts from otp_codes where email=$1 and not used and expires_at > now() order by created_at desc limit 1`, [email]);
    const bad = () => { recordFail(key); return new ApiError(400, 'The code is wrong or has expired. Ask for a new code.'); };
    if (!row) throw bad();
    if (!sameHash(row.code_hash, hashCode(process.env.SESSION_SECRET ?? '', email, code))) {
      await q(`update otp_codes set attempts=attempts+1, used=(attempts+1 >= $2) where id=$1`, [row.id, OTP_MAX_ATTEMPTS]); throw bad();
    }
    await q(`update otp_codes set used=true where id=$1`, [row.id]);
    let u = await one<{ id: string; is_guest: boolean; active: boolean }>('select id,is_guest,active from users where lower(email)=$1', [email]);
    if (u && !u.is_guest) throw new ApiError(400, 'This e-mail has a portal account. Please sign in with your password.');
    if (u && !u.active) throw new ApiError(403, 'This e-mail is blocked');
    if (!u) {
      const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      u = await one<{ id: string; is_guest: boolean; active: boolean }>(`insert into users(email,full_name,password_hash,role,is_guest,active) values($1,$2,$3,'viewer',true,true) returning id,is_guest,active`, [email, name, await hash(randomBytes(24).toString('hex'))]);
    }
    await q('update users set last_login_at=now() where id=$1', [u!.id]); await audit(null, email, 'login', 'guest', u!.id, 'General access sign-in (one-time code)');
    await createSession(u!.id);
    return ok();
  });
}
