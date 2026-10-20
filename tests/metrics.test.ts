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
test('org layout (columns mode): teams sit side by side, members stack in a column, collapsed branches are hidden', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'b', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'a2', reports_to: 'a' },
    { id: 'b1', reports_to: 'b' }, { id: 'b1x', reports_to: 'b1' }];
  const full = L.layoutTree(nodes, new Set(), 'columns');
  assert.equal(full.placed.size, 7);
  const P = (id: string) => full.placed.get(id)!;
  assert.equal(P('a1').x, P('a2').x);                    // stacked in one column
  assert.ok(P('a2').y > P('a1').y);                      // ...one under the other
  assert.ok(P('a').y < P('a1').y && P('d').y < P('a').y);
  assert.equal(P('a').y, P('b').y);                      // sibling teams share a row
  assert.ok(P('b').x > P('a').x);
  assert.ok(P('d').x > P('a').x && P('d').x < P('b').x + L.CARD_W); // manager sits over its teams
  assert.ok(P('b1').depth === 2 && P('b1x').depth === 3);
  assert.equal(full.paths.length, 6);                    // one link per reporting line
  assert.ok(full.paths.every((l) => /^M[\d.,-]+( L[\d.,-]+)+$/.test(l.d)));
  assert.ok(full.height > full.width * 0.5 || full.height > 0);
  const coll = L.layoutTree(nodes, new Set(['a']), 'columns');
  assert.equal(coll.placed.size, 5);
  assert.deepEqual(L.descendants(full.kids, 'd').sort(), ['a', 'a1', 'a2', 'b', 'b1', 'b1x']);
  // no two cards overlap
  const cards = [...full.placed.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j];
    assert.ok(a.x + L.CARD_W <= b.x || b.x + L.CARD_W <= a.x || a.y + L.CARD_H <= b.y || b.y + L.CARD_H <= a.y, `${a.id} overlaps ${b.id}`);
  }
});

test('org layout (vertical mode, default): one tall column, reports indented under their manager', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'b', reports_to: 'd' }, { id: 'b1', reports_to: 'b' }];
  const r = L.layoutTree(nodes, new Set());
  const P = (id: string) => r.placed.get(id)!;
  assert.equal(r.placed.size, 5);
  assert.deepEqual(['d', 'a', 'a1', 'b', 'b1'].map((i) => P(i).y).every((y, i, a) => i === 0 || y > a[i - 1]), true); // strictly top to bottom
  assert.ok(P('a').x > P('d').x && P('a1').x > P('a').x && P('b').x === P('a').x);
  assert.ok(r.height > r.width);
  assert.equal(r.paths.length, 4);
  const coll = L.layoutTree(nodes, new Set(['a']));
  assert.equal(coll.placed.size, 4);
  assert.ok(coll.height < r.height);
  const cards = [...r.placed.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) assert.ok(cards[i].y + L.CARD_H <= cards[j].y || cards[j].y + L.CARD_H <= cards[i].y);
});
