'use client';
import type { Status } from './types';

export class ApiFail extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } }

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined || opts.raw ? 'POST' : 'GET'),
    headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: 'no-store',
  });
  if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/setup')) { location.href = '/login'; }
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new ApiFail(res.status, (data && data.error) || `Request failed (${res.status})`);
  return data as T;
}

export async function download(url: string, body: unknown, fallbackName: string) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { let m = 'Export failed'; try { m = (await res.json()).error || m; } catch {} throw new Error(m); }
  const blob = await res.blob();
  saveBlob(blob, (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || fallbackName);
}
export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export function todayLocal(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
export const STATUS_BG: Record<Status, string> = {
  'Not Started': 'bg-slate-100 text-slate-700 ring-slate-300', 'In Progress': 'bg-brand-100 text-brand-800 ring-brand-300',
  'On Hold': 'bg-amber-100 text-amber-800 ring-amber-300', Closed: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
};
export const STATUS_DOT: Record<Status, string> = { 'Not Started': '#9AA5B1', 'In Progress': '#1F6FC9', 'On Hold': '#E8A317', Closed: '#2E9E5B' };
export function roleLabel(r: string) { return ({ admin: 'Department Manager / Administrator', bim_manager: 'BIM Manager', bim_coordinator: 'BIM Coordinator', viewer: 'Project Manager / Viewer' } as any)[r] || r; }
