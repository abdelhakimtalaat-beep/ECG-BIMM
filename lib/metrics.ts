// All dashboard / workload calculations live here so they are traceable and unit-tested (tests/metrics.test.ts).
// Rules: totals are computed over UNIQUE projects; a person's workload counts each project once; built-up area
// uses valid numeric values only; capacity percentages exist only when a capacity basis has been configured.
import type { Assignment, Capacity, Dataset, Employee, Filters, Project, Reel, Status } from './types.ts';
import { fmtDate } from './dates.ts';

export const STATUS_ORDER: Status[] = ['Not Started', 'In Progress', 'On Hold', 'Closed'];

export function weekdayOf(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
}

export function validArea(p: Pick<Project, 'built_up_area'>): number {
  const a = p.built_up_area;
  return typeof a === 'number' && Number.isFinite(a) && a > 0 ? a : 0;
}
export function hasArea(p: Pick<Project, 'built_up_area'>): boolean {
  return validArea(p) > 0;
}
/** Sum of valid built-up areas of unique projects (input is a list of projects, each id counted once). */
export function totalArea(projects: Project[]): number {
  const seen = new Set<string>();
  let t = 0;
  for (const p of projects) { if (seen.has(p.id)) continue; seen.add(p.id); t += validArea(p); }
  return t;
}
export function countByStatus(projects: Project[]): Record<Status, number> {
  const c: Record<Status, number> = { 'Not Started': 0, 'In Progress': 0, 'On Hold': 0, Closed: 0 };
  for (const p of projects) c[p.status]++;
  return c;
}

export function mapStatus(mappings: { source_status: string; activity_flag: string; target_status: Status }[], raw: string | null, flag: string | null): Status {
  const f = (flag || '').trim().toLowerCase();
  const norm = f === 'active' ? 'Active' : f === 'not active' ? 'Not Active' : '';
  const s = (raw || '').trim().toLowerCase();
  const hit = mappings.find((m) => m.source_status.toLowerCase() === s && m.activity_flag === norm)
    || mappings.find((m) => m.source_status.toLowerCase() === s && m.activity_flag === '');
  return hit ? hit.target_status : 'Not Started';
}

// ------------------------------------------------------------------ filtering
const lc = (s: string | null | undefined) => (s || '').toLowerCase();

export function applyProjectFilters(ds: Pick<Dataset, 'projects' | 'assignments'>, f: Filters): Project[] {
  const byProject = new Map<string, Assignment[]>();
  for (const a of ds.assignments) { const l = byProject.get(a.project_id); if (l) l.push(a); else byProject.set(a.project_id, [a]); }
  const q = f.q.trim().toLowerCase();
  return ds.projects.filter((p) => {
    const as = byProject.get(p.id) || [];
    if (q && !(lc(p.name).includes(q) || lc(p.project_no).includes(q) || lc(p.deltek_number).includes(q) || lc(p.client).includes(q))) return false;
    if (f.status.length && !f.status.includes(p.status)) return false;
    if (f.cde.length && !f.cde.includes(p.cde || '(none)')) return false;
    if (f.type.length && !f.type.includes(p.type || '(none)')) return false;
    if (f.deltek.length && !f.deltek.includes(p.deltek_number || '(none)')) return false;
    if (f.pm.length && !f.pm.includes(p.project_manager || '(none)')) return false;
    if (f.tm.length && !f.tm.includes(p.technical_manager || '(none)')) return false;
    if (f.client.length && !f.client.includes(p.client || '(none)')) return false;
    if (f.manager.length && !as.some((a) => a.role === 'manager' && f.manager.includes(a.employee_id))) return false;
    if (f.coordinator.length && !as.some((a) => a.role === 'coordinator' && f.coordinator.includes(a.employee_id))) return false;
    if (f.member.length && !as.some((a) => f.member.includes(a.employee_id))) return false;
    if (f.areaMin != null && !(validArea(p) >= f.areaMin && hasArea(p))) return false;
    if (f.areaMax != null && !(validArea(p) <= f.areaMax && hasArea(p))) return false;
    return true;
  });
}

export function applyReelFilters(reels: Reel[], f: Filters, employees: Employee[]): Reel[] {
  const q = f.q.trim().toLowerCase();
  return reels.filter((r) => {
    if (f.dateFrom && r.session_date < f.dateFrom) return false;
    if (f.dateTo && r.session_date > f.dateTo) return false;
    if (f.member.length && !(r.employee_id && f.member.includes(r.employee_id))) return false;
    if (q && !(lc(r.presenter_name).includes(q) || lc(r.topic).includes(q))) return false;
    return true;
  });
}

// ----------------------------------------------------------- per-person workload
export interface PersonStats {
  employee: Employee;
  role: 'manager' | 'coordinator';
  projects: number;              // unique assigned projects (all statuses)
  byStatus: Record<Status, number>;
  active: number;                // projects in capacity.count_statuses
  activeAssignments: number;     // assignments on non-closed projects
  area: number;                  // built-up area of unique assigned projects (valid numbers only)
  activeArea: number;
  areaMissing: number;           // assigned projects with no valid area
  reports: number;               // direct reports in the org chart
  load: number;                  // value used for relative comparison = active projects
  capacityPct: number | null;    // null unless a capacity basis is configured
  capacityBasis: string | null;
  relative: number | null;       // load / peer mean (a relative index, NOT utilisation)
}

export function directReports(employees: Employee[], id: string): number {
  return employees.filter((e) => e.reports_to === id && e.active).length;
}

export function capacityPercent(role: 'manager' | 'coordinator', s: { active: number; activeArea: number }, cap: Capacity): { pct: number | null; basis: string | null } {
  const maxP = role === 'manager' ? cap.max_projects_per_manager : cap.max_projects_per_coordinator;
  const maxA = role === 'manager' ? cap.max_area_per_manager : cap.max_area_per_coordinator;
  const parts: { v: number; b: string }[] = [];
  if (maxP && maxP > 0) parts.push({ v: s.active / maxP, b: `${s.active} active projects / max ${maxP}` });
  if (maxA && maxA > 0) parts.push({ v: s.activeArea / maxA, b: `${Math.round(s.activeArea).toLocaleString('en-US')} area / max ${maxA.toLocaleString('en-US')}` });
  if (cap.hours_per_project && cap.available_hours_per_person && cap.available_hours_per_person > 0)
    parts.push({ v: (s.active * cap.hours_per_project) / cap.available_hours_per_person, b: `${s.active} × ${cap.hours_per_project} h / ${cap.available_hours_per_person} h available` });
  if (!parts.length) return { pct: null, basis: null };
  const top = parts.reduce((a, b) => (b.v > a.v ? b : a));
  return { pct: Math.round(top.v * 100), basis: top.b };
}

export function personStats(ds: Pick<Dataset, 'employees' | 'projects' | 'assignments' | 'settings'>, projects?: Project[]): PersonStats[] {
  const projs = new Map((projects ?? ds.projects).map((p) => [p.id, p]));
  const cap = ds.settings.capacity;
  const out: PersonStats[] = [];
  const groups = new Map<string, Assignment[]>();
  for (const a of ds.assignments) {
    if (a.role === 'member' || !projs.has(a.project_id)) continue;
    const k = a.employee_id + '|' + a.role;
    const l = groups.get(k); if (l) l.push(a); else groups.set(k, [a]);
  }
  for (const [k, list] of groups) {
    const [empId, role] = k.split('|') as [string, 'manager' | 'coordinator'];
    const employee = ds.employees.find((e) => e.id === empId);
    if (!employee) continue;
    const seen = new Set<string>();
    const byStatus: Record<Status, number> = { 'Not Started': 0, 'In Progress': 0, 'On Hold': 0, Closed: 0 };
    let area = 0, activeArea = 0, active = 0, activeAssignments = 0, areaMissing = 0;
    for (const a of list) {
      if (seen.has(a.project_id)) continue;
      seen.add(a.project_id);
      const p = projs.get(a.project_id)!;
      byStatus[p.status]++;
      area += validArea(p);
      if (!hasArea(p)) areaMissing++;
      if (p.status !== 'Closed') activeAssignments++;
      if (cap.count_statuses.includes(p.status)) { active++; activeArea += validArea(p); }
    }
    const { pct, basis } = capacityPercent(role, { active, activeArea }, cap);
    out.push({ employee, role, projects: seen.size, byStatus, active, activeAssignments, area, activeArea, areaMissing,
      reports: directReports(ds.employees, empId), load: active, capacityPct: pct, capacityBasis: basis, relative: null });
  }
  for (const role of ['manager', 'coordinator'] as const) {
    const peers = out.filter((s) => s.role === role);
    const mean = peers.length ? peers.reduce((t, s) => t + s.load, 0) / peers.length : 0;
    for (const s of peers) s.relative = mean > 0 ? s.load / mean : null;
  }
  return out.sort((a, b) => b.load - a.load || b.projects - a.projects);
}

export type Imbalance = 'high' | 'low' | 'balanced';
/** Relative imbalance among peers of the same role. Needs at least 3 peers to mean anything. */
export function imbalanceOf(s: PersonStats, all: PersonStats[], ratio: number): Imbalance {
  const peers = all.filter((x) => x.role === s.role);
  if (peers.length < 3 || s.relative == null) return 'balanced';
  if (s.relative >= ratio) return 'high';
  if (s.relative <= 1 / ratio) return 'low';
  return 'balanced';
}

// ----------------------------------------------------------------- simulation
/** Move/copy nothing: returns the stats as they WOULD be after reassigning one project. Does not touch the data. */
export function simulateReassign(ds: Dataset, projectId: string, role: 'manager' | 'coordinator', fromId: string | null, toId: string) {
  const next: Assignment[] = ds.assignments.filter((a) => !(a.project_id === projectId && a.role === role && a.employee_id === fromId));
  if (!next.some((a) => a.project_id === projectId && a.role === role && a.employee_id === toId))
    next.push({ id: 'sim', project_id: projectId, employee_id: toId, role, package: null, source_row: null });
  const before = personStats(ds);
  const after = personStats({ ...ds, assignments: next });
  const pick = (list: PersonStats[], id: string | null) => (id ? list.find((s) => s.employee.id === id && s.role === role) ?? null : null);
  return { before: { from: pick(before, fromId), to: pick(before, toId) }, after: { from: pick(after, fromId), to: pick(after, toId) } };
}

// --------------------------------------------------------------------- reels
export function upcomingReels(reels: Reel[], today: string, days?: number): Reel[] {
  let end: string | null = null;
  if (days != null) { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); end = d.toISOString().slice(0, 10); }
  return reels.filter((r) => r.session_date >= today && r.status !== 'Cancelled' && r.status !== 'Completed' && (end == null || r.session_date <= end))
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
}
/** Past sessions without a recorded outcome (not Completed / Cancelled / Postponed). */
export function incompleteReels(reels: Reel[], today: string): Reel[] {
  return reels.filter((r) => r.session_date < today && (r.status === 'Not recorded' || r.status === 'Planned'));
}
export function reelConflicts(reels: Reel[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, m: string) => { const l = out.get(id); if (l) l.push(m); else out.set(id, [m]); };
  const live = reels.filter((r) => r.status !== 'Cancelled');
  const byDate = new Map<string, Reel[]>();
  for (const r of live) {
    (byDate.get(r.session_date) ?? byDate.set(r.session_date, []).get(r.session_date)!).push(r);
  }
  for (const [d, l] of byDate) if (l.length > 1) for (const r of l) add(r.id, `Another session is scheduled on ${d}`);
  for (const r of reels) if (weekdayOf(r.session_date) !== r.weekday) add(r.id, `Weekday ${r.weekday} does not match the date (${weekdayOf(r.session_date)})`);
  return out;
}
export function reelStats(reels: Reel[]) {
  const by = (k: (r: Reel) => string) => { const m: Record<string, number> = {}; for (const r of reels) m[k(r)] = (m[k(r)] || 0) + 1; return m; };
  const total = reels.length;
  const completed = reels.filter((r) => r.status === 'Completed').length;
  return {
    total, completed,
    upcoming: reels.filter((r) => r.status === 'Planned').length,
    postponed: reels.filter((r) => r.status === 'Postponed').length,
    cancelled: reels.filter((r) => r.status === 'Cancelled').length,
    notRecorded: reels.filter((r) => r.status === 'Not recorded').length,
    completionRate: total ? completed / total : null,
    byPresenter: by((r) => r.presenter_name), byMonth: by((r) => r.session_date.slice(0, 7)), byTopic: by((r) => r.topic || '(no topic yet)'),
  };
}

// -------------------------------------------------------------------- alerts
export interface Alert { id: string; level: 'high' | 'medium' | 'info'; title: string; detail: string; link?: string; ids?: string[] }
export function buildAlerts(ds: Dataset, projects: Project[], today: string): Alert[] {
  const alerts: Alert[] = [];
  const ids = new Set(projects.map((p) => p.id));
  const asg = ds.assignments.filter((a) => ids.has(a.project_id));
  const withRole = (role: string) => new Set(asg.filter((a) => a.role === role).map((a) => a.project_id));
  const hasM = withRole('manager'), hasC = withRole('coordinator');
  const noMgr = projects.filter((p) => !hasM.has(p.id));
  const noCoord = projects.filter((p) => p.status !== 'Closed' && !hasC.has(p.id));
  if (noMgr.length) alerts.push({ id: 'no-mgr', level: 'high', title: `${noMgr.length} project(s) without a BIM Manager`, detail: noMgr.slice(0, 5).map((p) => p.name).join(', '), ids: noMgr.map((p) => p.id), link: '/projects' });
  if (noCoord.length) alerts.push({ id: 'no-coord', level: 'medium', title: `${noCoord.length} open project(s) without a BIM Coordinator`, detail: noCoord.slice(0, 5).map((p) => p.name).join(', '), ids: noCoord.map((p) => p.id), link: '/projects' });
  const missing = projects.filter((p) => p.status !== 'Closed' && (!p.project_no || !hasArea(p) || !p.cde || !p.type));
  if (missing.length) alerts.push({ id: 'missing', level: 'medium', title: `${missing.length} open project(s) with missing information`, detail: 'Missing project number, built-up area, CDE or type.', ids: missing.map((p) => p.id), link: '/projects' });
  const hold = projects.filter((p) => p.status === 'On Hold');
  if (hold.length) alerts.push({ id: 'hold', level: 'info', title: `${hold.length} project(s) on hold`, detail: hold.slice(0, 5).map((p) => p.name).join(', '), ids: hold.map((p) => p.id), link: '/projects' });
  const stats = personStats({ ...ds, assignments: asg }, projects);
  const ratio = ds.settings.capacity.imbalance_ratio;
  for (const s of stats) {
    if (s.capacityPct != null && s.capacityPct > 100) alerts.push({ id: 'cap-' + s.employee.id + s.role, level: 'high', title: `${s.employee.name} is over the configured capacity (${s.capacityPct}%)`, detail: s.capacityBasis || '', link: '/workload' });
    else if (s.capacityPct == null && imbalanceOf(s, stats, ratio) === 'high')
      alerts.push({ id: 'rel-' + s.employee.id + s.role, level: 'medium', title: `${s.employee.name}: ${s.load} active projects, ${s.relative!.toFixed(1)}× the ${s.role} average`, detail: 'Relative comparison only — no capacity has been configured.', link: '/workload' });
  }
  const up = upcomingReels(ds.reels, today, ds.settings.alerts.reel_reminder_days);
  if (up.length) alerts.push({ id: 'reel-up', level: 'info', title: `${up.length} BIM Reel session(s) in the next ${ds.settings.alerts.reel_reminder_days} days`, detail: up.map((r) => `${fmtDate(r.session_date)} ${r.presenter_name}`).join(' · '), link: '/reels' });
  const inc = incompleteReels(ds.reels, today);
  if (inc.length) alerts.push({ id: 'reel-late', level: 'medium', title: `${inc.length} past BIM Reel session(s) without a recorded outcome`, detail: 'Mark each as Completed, Postponed or Cancelled.', link: '/reels' });
  return alerts;
}

// ------------------------------------------------------------ org / consistency
export function chainToRoot(employees: Employee[], id: string): string[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const out: string[] = []; let cur = byId.get(id); const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) { out.push(cur.id); guard.add(cur.id); cur = cur.reports_to ? byId.get(cur.reports_to) : undefined; }
  return out;
}
export function wouldCreateCycle(employees: Employee[], employeeId: string, newManagerId: string | null): boolean {
  if (!newManagerId) return false;
  if (newManagerId === employeeId) return true;
  return chainToRoot(employees, newManagerId).includes(employeeId);
}
/** Coordinators assigned under a manager's project although the org chart says they report to someone else. */
export function inconsistencies(ds: Pick<Dataset, 'employees' | 'projects' | 'assignments'>) {
  const byId = new Map(ds.employees.map((e) => [e.id, e]));
  const out: { project: Project; manager: Employee; coordinator: Employee; reportsTo: Employee | null }[] = [];
  const mgrOf = new Map<string, string[]>();
  for (const a of ds.assignments) if (a.role === 'manager') (mgrOf.get(a.project_id) ?? mgrOf.set(a.project_id, []).get(a.project_id)!).push(a.employee_id);
  const seen = new Set<string>();
  for (const a of ds.assignments) {
    if (a.role !== 'coordinator') continue;
    const c = byId.get(a.employee_id); if (!c) continue;
    for (const m of mgrOf.get(a.project_id) || []) {
      if (c.reports_to === m) continue;
      const key = c.id + '|' + m; if (seen.has(key)) continue; seen.add(key);
      const p = ds.projects.find((x) => x.id === a.project_id); const mg = byId.get(m);
      if (p && mg) out.push({ project: p, manager: mg, coordinator: c, reportsTo: c.reports_to ? byId.get(c.reports_to) ?? null : null });
    }
  }
  return out;
}

export function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.map((v) => v || '(none)'))].sort((a, b) => a.localeCompare(b));
}
export function fmtArea(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
