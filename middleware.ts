import { NextResponse, type NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// Page-level gate. API routes do their own authentication and authorisation (lib/auth.ts, lib/perm.ts).
const PUBLIC = ['/login', '/setup'];
const PWA_FILES = ['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']; // must load before sign-in so the phone can install the app
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api')) { const h = new Headers(req.headers); h.set('x-ecg-path', pathname); h.set('x-ecg-method', req.method); return NextResponse.next({ request: { headers: h } }); }   /* lets the server limit general-access (guest) sessions per request */
  if (PUBLIC.some((p) => pathname === p) || pathname === '/ecg-logo.png' || pathname === '/favicon.ico' || PWA_FILES.includes(pathname)) return NextResponse.next();
  const token = req.cookies.get('ecg_session')?.value;
  let valid = false, uid: unknown, iat = 0;
  const key = process.env.SESSION_SECRET ? new TextEncoder().encode(process.env.SESSION_SECRET) : null;
  if (token && key) { try { const { payload } = await jwtVerify(token, key); valid = true; uid = payload.uid; iat = payload.iat ?? 0; } catch {} }
  if (!valid) { const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; return NextResponse.redirect(url); }
  const res = NextResponse.next();
  /* Sliding session: while the person keeps working, the 10-hour session is renewed (at most once an hour), so it never ends in the middle of the work day. */
  if (key && typeof uid === 'string' && Date.now() / 1000 - iat > 3600) {
    const fresh = await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('36000s').sign(key);
    res.cookies.set('ecg_session', fresh, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 36000 });
  }
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
