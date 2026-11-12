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

// ---------------------------------------------------------------- approval chain
export type VacStatus = 'pending_manager' | 'pending_department' | 'approved' | 'rejected';
export const VAC_STATUS_LABEL: Record<VacStatus, string> = { pending_manager: 'Waiting for the direct manager', pending_department: 'Waiting for the department manager', approved: 'Approved', rejected: 'Rejected' };
/** BIM managers and department managers (and anybody with no direct manager, or whose direct manager is a department manager) go straight to the department manager; everybody else is approved by the direct manager first. */
export function vacationRoute(requesterCategory: string, managerId: string | null, managerCategory: string | null): 'manager' | 'department' {
  if (requesterCategory === 'bim_manager' || requesterCategory === 'department_manager') return 'department';
  if (!managerId || managerCategory === 'department_manager') return 'department';
  return 'manager';
}
export const initialStatus = (route: 'manager' | 'department'): VacStatus => (route === 'manager' ? 'pending_manager' : 'pending_department');
export function afterDecision(status: VacStatus, approve: boolean): VacStatus {
  if (status !== 'pending_manager' && status !== 'pending_department') return status;
  return !approve ? 'rejected' : status === 'pending_manager' ? 'pending_department' : 'approved';
}
export interface VacActor { employee_id: string | null; role: string; isDeptManager: boolean }
export interface VacLite { status: VacStatus; employee_id: string; manager_id: string | null }
/** Nobody decides on his own request. The direct manager decides the first step; department managers (or the Administrator) the last one. */
export function canDecideVacation(me: VacActor, v: VacLite): boolean {
  if (!me.employee_id && me.role !== 'admin') return false;
  if (me.employee_id && me.employee_id === v.employee_id) return false;
  if (v.status === 'pending_manager') return !!me.employee_id && me.employee_id === v.manager_id;
  if (v.status === 'pending_department') return me.isDeptManager || me.role === 'admin';
  return false;
}
