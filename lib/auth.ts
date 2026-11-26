import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { one } from './db';
import type { Me, Role } from './types';
import { canSeeTab } from './tabs';
import { guestApiAllowed } from './guest';
import { getGuestCfg } from './guestServer';

export const COOKIE = 'ecg_session';
const MAX_AGE = 60 * 60 * 10; // 10 hours

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error('SESSION_SECRET must be set (at least 24 characters)');
  return new TextEncoder().encode(s);
}
export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Returns the signed-in user (re-read from the database so role changes / deactivation apply immediately) or null. */
export async function currentUser(): Promise<Me | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let uid: unknown;
  try { uid = (await jwtVerify(token, secret())).payload.uid; } catch { return null; }   /* a bad or expired cookie = signed out */
  /* A database hiccup (dropped connection, busy pool) must NOT look like "signed out": retry once, then report "busy" instead of logging the person out. */
  const read = () => one<Me & { active: boolean; is_guest: boolean }>('select id,email,full_name,role,employee_id,allowed_tabs,active,is_guest from users where id=$1', [uid]);
  let u: (Me & { active: boolean; is_guest: boolean }) | null;
  try { try { u = await read(); } catch { await new Promise((r) => setTimeout(r, 300)); u = await read(); } } catch { throw new ApiError(503, 'The server is busy. Please try again in a moment'); }
  try {
    if (!u || !u.active) return null;
    if (u.is_guest) { const g = await getGuestCfg(); if (!g.enabled) return null; return { id: u.id, email: u.email, full_name: u.full_name, role: 'viewer', employee_id: null, allowed_tabs: g.tabs, is_guest: true }; }   /* general access: always read only, tabs from the Administrator's setting */
    return { id: u.id, email: u.email, full_name: u.full_name, role: u.role, employee_id: u.employee_id, allowed_tabs: u.allowed_tabs ?? null };
  } catch { throw new ApiError(503, 'The server is busy. Please try again in a moment'); }
}
export async function requireUser(roles?: Role[]): Promise<Me> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, 'Not signed in');
  if (u.is_guest) { const h = await headers(); if (!guestApiAllowed(h.get('x-ecg-method'), h.get('x-ecg-path'), u.allowed_tabs ?? [])) throw new ApiError(403, 'This is not available with general access'); }
  if (roles && !roles.includes(u.role)) throw new ApiError(403, 'You do not have permission to do this');
  return u;
}
/** Like requireUser, and the user must be allowed to open that tab (read-only users can be limited to chosen tabs). */
export async function requireTab(href: string): Promise<Me> {
  const u = await requireUser();
  if (!canSeeTab(u, href)) throw new ApiError(403, 'This page is not enabled for your account');
  return u;
}
export const hash = (pw: string) => bcrypt.hash(pw, 12);
export const verify = (pw: string, h: string) => bcrypt.compare(pw, h);
export function checkPassword(pw: string) {
  if (typeof pw !== 'string' || pw.length < 10) throw new ApiError(400, 'Password must be at least 10 characters');
}

// Best-effort brute-force throttle (per server instance).
const fails = new Map<string, { n: number; t: number }>();
export function throttle(key: string) {
  const now = Date.now(), f = fails.get(key);
  if (f && now - f.t < 15 * 60_000 && f.n >= 8) throw new ApiError(429, 'Too many attempts. Try again in 15 minutes.');
}
export function recordFail(key: string) {
  const now = Date.now(), f = fails.get(key);
  fails.set(key, f && now - f.t < 15 * 60_000 ? { n: f.n + 1, t: f.t } : { n: 1, t: now });
}
export const clearFails = (key: string) => fails.delete(key);
