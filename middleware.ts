import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Page-level gate. API routes do their own authentication and authorisation (lib/auth.ts, lib/perm.ts).
const PUBLIC = ['/login', '/setup'];
const PWA_FILES = ['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']; // must load before sign-in so the phone can install the app
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || PUBLIC.some((p) => pathname === p) || pathname === '/ecg-logo.png' || pathname === '/favicon.ico' || PWA_FILES.includes(pathname)) return NextResponse.next();
  const token = req.cookies.get('ecg_session')?.value;
  let valid = false;
  if (token && process.env.SESSION_SECRET) { try { await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET)); valid = true; } catch {} }
  if (!valid) { const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; return NextResponse.redirect(url); }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
