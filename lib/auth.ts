import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { one } from './db';
import type { Me, Role } from './types';

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
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await one<Me & { active: boolean }>('select id,email,full_name,role,employee_id,active from users where id=$1', [payload.uid]);
    if (!u || !u.active) return null;
    return { id: u.id, email: u.email, full_name: u.full_name, role: u.role, employee_id: u.employee_id };
  } catch { return null; }
}
export async function requireUser(roles?: Role[]): Promise<Me> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, 'Not signed in');
  if (roles && !roles.includes(u.role)) throw new ApiError(403, 'You do not have permission to do this');
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
