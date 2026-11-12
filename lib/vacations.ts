// Vacation requests (BIMMers > Vacations). Pure; unit tested.
export const AUTO_REPLY_FROM_DAYS = 3;
export const AUTO_REPLY_TEXT = 'An automatic email reply should be sent to related teams during your vacation';
const DAY = 86400000;
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
/** Calendar days from the first to the last day, both included. 0 when a date is missing or the end is before the start. */
export function vacationDays(start: string, end: string): number {
  if (!ymd.test(start) || !ymd.test(end)) return 0;
  const n = Math.round((toUtc(end) - toUtc(start)) / DAY) + 1; return n >= 1 ? n : 0;
}
export const needsAutoReply = (days: number) => days >= AUTO_REPLY_FROM_DAYS;
