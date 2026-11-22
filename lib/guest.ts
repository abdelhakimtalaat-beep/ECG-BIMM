// General access (one-time password sign-in, read only). Pure helpers; unit tested. No imports on purpose.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export interface GuestCfg { enabled: boolean; tabs: string[]; domains: string[] }
export const OTP_MINUTES = 10, OTP_MAX_ATTEMPTS = 5;

export const normalizeEmail = (e: unknown): string | null => { const s = String(e ?? '').trim().toLowerCase(); return s.length <= 200 && /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']{2,}$/.test(s) ? s : null; };
export const parseDomains = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/)).map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))].slice(0, 50);
/** An empty domain list lets every e-mail address ask for a code. */
export const emailAllowed = (email: string, domains: string[]) => !domains.length || domains.some((d) => email.endsWith('@' + d));
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (secret: string, email: string, code: string) => createHash('sha256').update(`${secret}|${email}|${code}`).digest('hex');
export const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Which API calls a guest may make. Anything not listed is refused (fail closed), so a guest can never reach administration,
 * HR files, imports, exports or any change. `tabs` = the tabs the Administrator enabled.
 */
const PREFIX_TABS: [string, string[]][] = [
  ['projects', ['/projects', '/', '/teams', '/acc-stats']], ['teams', ['/teams', '/tasks']], ['tasks', ['/tasks']], ['task-areas', ['/tasks']], ['reels', ['/reels', '/']], ['courses', ['/courses']],
  ['contacts', ['/contacts']], ['meetings', ['/meetings']], ['vacations', ['/vacations']], ['evaluations', ['/evaluation']], ['proposals', ['/proposals']], ['process', ['/process-map']],
  ['email-templates', ['/email-templates']], ['wishes', ['/wishes']], ['birthdays', ['/', '/org', '/contacts']], ['issues', ['/']], ['assignments', ['/projects', '/teams']],
  ['employees', ['/org', '/contacts', '/teams']], ['acc/assignees', ['/acc-stats']],
];
export function guestApiAllowed(method: string | null, path: string | null, tabs: string[]): boolean {
  if (!method || !path) return false; const p = path.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (p === 'auth/logout') return method === 'POST';
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (p === 'auth/me' || p === 'logo' || p === 'data') return true;
  if (!tabs.length) return false;
  if (p === 'acc/model') return tabs.includes('/projects') || tabs.includes('/projects/map') || tabs.includes('/');   /* the 3D model viewer of a project (not the model picker, which is acc/model/browse) */
  if (p === 'acc/locations') return tabs.includes('/projects/map');   /* map pins (GET only: the refresh is a POST and is refused above) */
  if (/^(projects|employees)\/[^/]+\/photo$/.test(p)) return true;
  if (p.startsWith('files/')) return tabs.some((t) => ['/projects', '/projects/map', '/projects/clients', '/', '/org', '/teams', '/contacts'].includes(t));
  if (p.startsWith('employees/')) return false;   /* HR data, CV and documents of an employee */
  const hit = PREFIX_TABS.find(([k]) => p === k || p.startsWith(k + '/'));
  return !!hit && hit[1].some((t) => tabs.includes(t));
}
