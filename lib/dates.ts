// Date formatting shared by server and client code. Every date shown or exported by the portal uses dd-Mmm-yyyy (e.g. 05-Mar-2026).
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' (a plain calendar date) or an ISO timestamp -> 'dd-Mmm-yyyy'. */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}-${MON[Number(s.slice(5, 7)) - 1] ?? '???'}-${s.slice(0, 4)}`; // no timezone shift for plain dates
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : `${p2(d.getDate())}-${MON[d.getMonth()]}-${d.getFullYear()}`;
}
/** A Date in the viewer's local time -> 'dd-Mmm-yyyy HH:mm'. */
export const fmtDateTime = (d: Date): string => `${fmtDate(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** A Date in UTC -> 'dd-Mmm-yyyy HH:mm UTC' (used by server-side exports). */
export const fmtDateTimeUtc = (d: Date): string => `${p2(d.getUTCDate())}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
