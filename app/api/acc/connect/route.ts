import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { handle } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorizeUrl } from '@/lib/accApi';

export const dynamic = 'force-dynamic';
/** Administrator: sends the browser to the Autodesk sign-in page. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser(['admin']);
    const redirect = process.env.APS_CALLBACK_URL || new URL('/api/acc/callback', req.url).toString();
    const state = crypto.randomBytes(16).toString('hex'); const res = NextResponse.redirect(authorizeUrl(redirect, state));
    res.cookies.set('acc_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/acc', maxAge: 600 });
    return res;
  });
}
