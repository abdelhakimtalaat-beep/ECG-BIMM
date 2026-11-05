// Default order of project lists everywhere: by status, then by BIM Manager, then by project number / name. Pure; unit tested.
export const STATUS_RANK: Record<string, number> = { 'In Progress': 0, 'Not Started': 1, 'On Hold': 2, Closed: 3 };
type P = { id: string; status: string; project_no?: string | null; name: string };
/** project id -> BIM Manager name(s), several managers joined with " / " in alphabetical order. */
export function managerNames(assignments: { project_id: string; employee_id: string; role: string }[], employees: { id: string; name: string }[]): Map<string, string> {
  const nm = new Map(employees.map((e) => [e.id, e.name])); const by = new Map<string, string[]>();
  for (const a of assignments) { if (a.role !== 'manager') continue; const n = nm.get(a.employee_id); if (n) (by.get(a.project_id) ?? by.set(a.project_id, []).get(a.project_id)!).push(n); }
  return new Map([...by].map(([k, v]) => [k, v.sort((x, y) => x.localeCompare(y)).join(' / ')]));
}
const NONE = '￿'; // projects without a BIM Manager come last
const byMgr = (m: Map<string, string>, a: P, b: P) => (m.get(a.id) || NONE).localeCompare(m.get(b.id) || NONE, undefined, { sensitivity: 'base' });
const byRank = (a: P, b: P) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
const byNo = (a: P, b: P) => (a.project_no ?? '').localeCompare(b.project_no ?? '', undefined, { numeric: true }) || a.name.localeCompare(b.name);
/** Status, then BIM Manager, then project number. */
export const compareByStatusThenManager = (m: Map<string, string>) => (a: P, b: P) => byRank(a, b) || byMgr(m, a, b) || byNo(a, b);
/** BIM Manager first, then status (when the user sorts by manager). */
export const compareByManagerThenStatus = (m: Map<string, string>) => (a: P, b: P) => byMgr(m, a, b) || byRank(a, b) || byNo(a, b);
