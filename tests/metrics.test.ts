import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../lib/metrics.ts';

const cap = { max_projects_per_coordinator: null, max_projects_per_manager: null, max_area_per_coordinator: null, max_area_per_manager: null,
  hours_per_project: null, available_hours_per_person: null, imbalance_ratio: 1.5, count_statuses: ['In Progress', 'Not Started'] } as any;
const emp = (id: string, cat: string, reports_to: string | null = null) => ({ id, name: id, employee_code: null, job_title: cat, job_category: cat, discipline: null, year_value: null, team_location: null, active: true, notes: null, reports_to }) as any;
const proj = (id: string, status: string, area: number | null) => ({ id, name: id, project_no: id, cde: 'ACC', type: 'BIM', built_up_area: area, status }) as any;
const asg = (p: string, e: string, role: string) => ({ id: p + e + role, project_id: p, employee_id: e, role, package: null, source_row: null }) as any;

const ds: any = {
  employees: [emp('D', 'department_manager'), emp('M1', 'bim_manager', 'D'), emp('M2', 'bim_manager', 'D'), emp('M3', 'bim_manager', 'D'),
    emp('C1', 'bim_coordinator', 'M1'), emp('C2', 'bim_coordinator', 'M2')],
  projects: [proj('p1', 'In Progress', 1000), proj('p2', 'In Progress', null), proj('p3', 'Closed', 500), proj('p4', 'On Hold', 200), proj('p5', 'In Progress', 300)],
  assignments: [asg('p1', 'M1', 'manager'), asg('p2', 'M1', 'manager'), asg('p3', 'M1', 'manager'), asg('p5', 'M1', 'manager'),
    asg('p4', 'M2', 'manager'), asg('p1', 'C1', 'coordinator'), asg('p2', 'C1', 'coordinator'), asg('p5', 'C2', 'coordinator'),
    asg('p1', 'C2', 'coordinator'), asg('p1', 'C2', 'coordinator')],
  reels: [], settings: { capacity: cap, alerts: { reel_reminder_days: 7, outlier_area: 5e6 } }, mappings: [], history: [],
};

test('total area counts each project once and ignores missing values', () => {
  assert.equal(m.totalArea([...ds.projects, ds.projects[0]]), 2000);
});
test('status counts', () => {
  assert.deepEqual(m.countByStatus(ds.projects), { 'Not Started': 0, 'In Progress': 3, 'On Hold': 1, Closed: 1 });
});
test('person stats do not double count duplicated assignment rows', () => {
  const s = m.personStats(ds).find((x: any) => x.employee.id === 'C2' && x.role === 'coordinator')!;
  assert.equal(s.projects, 2); // p5 + p1 (p1 twice in the data)
  assert.equal(s.area, 1300);
});
test('manager stats: area of unique projects and missing-area count', () => {
  const s = m.personStats(ds).find((x: any) => x.employee.id === 'M1' && x.role === 'manager')!;
  assert.equal(s.projects, 4); assert.equal(s.area, 1800); assert.equal(s.areaMissing, 1);
  assert.equal(s.active, 3); assert.equal(s.byStatus.Closed, 1); assert.equal(s.reports, 1);
});
test('capacity percent is null until a basis is configured, then follows the highest ratio', () => {
  assert.equal(m.personStats(ds)[0].capacityPct, null);
  const ds2 = { ...ds, settings: { ...ds.settings, capacity: { ...cap, max_projects_per_manager: 4 } } };
  const s = m.personStats(ds2).find((x: any) => x.employee.id === 'M1' && x.role === 'manager')!;
  assert.equal(s.capacityPct, 75);
});
test('hours based capacity', () => {
  const r = m.capacityPercent('coordinator', { active: 2, activeArea: 0 }, { ...cap, hours_per_project: 40, available_hours_per_person: 160 });
  assert.equal(r.pct, 50);
});
test('imbalance needs 3 peers and uses the configured ratio', () => {
  const st = m.personStats(ds);
  const m1 = st.find((x: any) => x.employee.id === 'M1' && x.role === 'manager')!;
  assert.equal(m.imbalanceOf(m1, st, 1.5), 'balanced'); // only 2 manager peers -> no verdict
  const ds3 = { ...ds, assignments: [...ds.assignments, asg('p3', 'M3', 'manager')] }; // M3 has a closed project only (load 0)
  const st3 = m.personStats(ds3);
  const hi = st3.find((x: any) => x.employee.id === 'M1' && x.role === 'manager')!;
  const lo = st3.find((x: any) => x.employee.id === 'M3' && x.role === 'manager')!;
  assert.equal(m.imbalanceOf(hi, st3, 1.5), 'high');
  assert.equal(m.imbalanceOf(lo, st3, 1.5), 'low');
});
test('simulation does not mutate the dataset', () => {
  const copy = JSON.stringify(ds.assignments);
  const r = m.simulateReassign(ds, 'p5', 'coordinator', 'C2', 'C1');
  assert.equal(JSON.stringify(ds.assignments), copy);
  assert.equal(r.before.to!.projects, 2); assert.equal(r.after.to!.projects, 3); assert.equal(r.after.from!.projects, 1);
});
test('weekday validation', () => {
  assert.equal(m.weekdayOf('2026-08-16'), 'Sunday');
  assert.equal(m.weekdayOf('2026-08-19'), 'Wednesday');
});
test('reel conflicts: weekday mismatch and same-day sessions', () => {
  const r = (id: string, d: string, wd: string, name = id) => ({ id, employee_id: id, presenter_code: null, presenter_name: name, weekday: wd, session_date: d, topic: null, status: 'Planned', notes: null, link: null, attachment_id: null }) as any;
  const c = m.reelConflicts([r('a', '2026-08-16', 'Sunday'), r('b', '2026-08-16', 'Sunday'), r('c', '2026-08-17', 'Sunday')]);
  assert.equal(c.get('a')!.length, 1); assert.equal(c.get('c')!.length, 1);
});
test('past sessions without outcome are not assumed completed', () => {
  const r = (id: string, d: string, st: string) => ({ id, session_date: d, status: st }) as any;
  const list = [r('a', '2026-08-16', 'Not recorded'), r('b', '2026-08-23', 'Completed'), r('c', '2026-12-01', 'Planned')];
  assert.deepEqual(m.incompleteReels(list, '2026-10-20').map((x: any) => x.id), ['a']);
  assert.deepEqual(m.upcomingReels(list, '2026-10-20').map((x: any) => x.id), ['c']);
});
test('status mapping falls back to the status without a flag', () => {
  const maps: any = [{ source_status: 'Open', activity_flag: 'Active', target_status: 'In Progress' }, { source_status: 'Open', activity_flag: 'Not Active', target_status: 'Not Started' }, { source_status: 'Hold', activity_flag: '', target_status: 'On Hold' }];
  assert.equal(m.mapStatus(maps, 'Open', 'NOT Active'), 'Not Started');
  assert.equal(m.mapStatus(maps, 'Hold', 'Active '), 'On Hold');
  assert.equal(m.mapStatus(maps, 'Unknown', null), 'Not Started');
});
test('filters combine and exclude projects without area when an area range is set', () => {
  const f: any = { q: '', manager: ['M1'], coordinator: [], member: [], status: [], cde: [], type: [], areaMin: 250, areaMax: null, dateFrom: null, dateTo: null };
  assert.deepEqual(m.applyProjectFilters(ds, f).map((p: any) => p.id), ['p1', 'p3', 'p5']);
});
test('cycle detection for reporting changes', () => {
  assert.equal(m.wouldCreateCycle(ds.employees, 'D', 'C1'), true);
  assert.equal(m.wouldCreateCycle(ds.employees, 'C1', 'M2'), false);
});
test('inconsistency detector flags coordinators under a manager they do not report to', () => {
  const r = m.inconsistencies(ds);
  assert.ok(r.some((x: any) => x.coordinator.id === 'C2' && x.manager.id === 'M1'));
});
test('alerts never show capacity % without a basis', () => {
  const a = m.buildAlerts(ds, ds.projects, '2026-10-20');
  assert.ok(!a.some((x: any) => x.id.startsWith('cap-')));
});

import * as L from '../lib/orgLayout.ts';
test('org layout centres parents over children and hides collapsed branches', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'b', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'a2', reports_to: 'a' }];
  const full = L.layoutTree(nodes, new Set());
  assert.equal(full.placed.size, 5);
  const a = full.placed.get('a')!, a1 = full.placed.get('a1')!, a2 = full.placed.get('a2')!;
  assert.equal(a.x, (a1.x + a2.x) / 2);
  assert.ok(full.placed.get('d')!.y < a.y && a.y < a1.y);
  const coll = L.layoutTree(nodes, new Set(['a']));
  assert.equal(coll.placed.size, 3);
  assert.deepEqual(L.descendants(full.kids, 'd').sort(), ['a', 'a1', 'a2', 'b']);
});
