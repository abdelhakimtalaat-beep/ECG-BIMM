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
  const r = (id: string, d: string, wd: string, name = id) => ({ id, employee_id: id, presenter_code: null, presenter_name: name, weekday: wd, session_date: d, topic: null, software: null, status: 'Planned', notes: null, link: null, attachment_id: null }) as any;
  const c = m.reelConflicts([r('a', '2026-08-16', 'Sunday'), r('b', '2026-08-16', 'Sunday'), r('c', '2026-08-17', 'Sunday')]);
  assert.equal(c.get('a')!.length, 1); assert.equal(c.get('c')!.length, 1);
});
test('a speaker with several sessions is NOT flagged (no alarm for presenting more than once)', () => {
  const r = (id: string, d: string, wd: string) => ({ id, employee_id: 'same', presenter_code: null, presenter_name: 'Same Person', weekday: wd, session_date: d, topic: null, software: null, status: 'Planned', notes: null, link: null, attachment_id: null }) as any;
  const c = m.reelConflicts([r('a', '2026-08-16', 'Sunday'), r('b', '2026-08-23', 'Sunday'), r('c', '2026-08-30', 'Sunday')]);
  assert.equal(c.size, 0);
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
  const f: any = { q: '', manager: ['M1'], coordinator: [], member: [], status: [], cde: [], type: [], deltek: [], pm: [], tm: [], client: [], areaMin: 250, areaMax: null, dateFrom: null, dateTo: null };
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
test('org layout (side mode, default): manager left, teams to the right, one row per person, parents centred', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'b', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'a2', reports_to: 'a' },
    { id: 'b1', reports_to: 'b' }, { id: 'c', reports_to: 'd' }];
  const r = L.layoutTree(nodes, new Set());
  const P = (id: string) => r.placed.get(id)!;
  assert.equal(r.placed.size, 7);
  assert.ok(P('d').x < P('a').x && P('a').x < P('a1').x);   // depth runs left to right
  assert.equal(P('a').x, P('b').x); assert.equal(P('a1').x, P('a2').x);
  assert.ok(P('a1').y < P('a2').y && P('a2').y < P('b1').y && P('b1').y < P('c').y); // top to bottom, no shared rows
  assert.equal(P('a').y, (P('a1').y + P('a2').y) / 2);       // manager centred on its team
  assert.equal(P('d').y, (P('a').y + P('c').y) / 2);         // root centred on its first and last report
  assert.equal(r.paths.length, 6);
  assert.ok(r.paths.every((l) => /^M[\d.,-]+( L[\d.,-]+)+$/.test(l.d)));
  const coll = L.layoutTree(nodes, new Set(['a']));
  assert.equal(coll.placed.size, 5);
  assert.deepEqual(L.descendants(r.kids, 'd').sort(), ['a', 'a1', 'a2', 'b', 'b1', 'c']);
  const cards = [...r.placed.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const m = cards[i], n = cards[j];
    assert.ok(m.x + L.CARD_W <= n.x || n.x + L.CARD_W <= m.x || m.y + L.CARD_H <= n.y || n.y + L.CARD_H <= m.y, `${m.id} overlaps ${n.id}`);
  }
});

test('org layout (vertical mode, default): one tall column, reports indented under their manager', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'b', reports_to: 'd' }, { id: 'b1', reports_to: 'b' }];
  const r = L.layoutTree(nodes, new Set(), 'vertical');
  const P = (id: string) => r.placed.get(id)!;
  assert.equal(r.placed.size, 5);
  assert.deepEqual(['d', 'a', 'a1', 'b', 'b1'].map((i) => P(i).y).every((y, i, a) => i === 0 || y > a[i - 1]), true); // strictly top to bottom
  assert.ok(P('a').x > P('d').x && P('a1').x > P('a').x && P('b').x === P('a').x);
  assert.ok(r.height > r.width);
  assert.equal(r.paths.length, 4);
  const coll = L.layoutTree(nodes, new Set(['a']), 'vertical');
  assert.equal(coll.placed.size, 4);
  assert.ok(coll.height < r.height);
  const cards = [...r.placed.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) assert.ok(cards[i].y + L.CARD_H <= cards[j].y || cards[j].y + L.CARD_H <= cards[i].y);
});

test('org layout (horizontal mode): each level is one row, siblings side by side, parents centred over reports', () => {
  const nodes = [{ id: 'd', reports_to: null }, { id: 'a', reports_to: 'd' }, { id: 'b', reports_to: 'd' }, { id: 'a1', reports_to: 'a' }, { id: 'a2', reports_to: 'a' }, { id: 'b1', reports_to: 'b' }];
  const r = L.layoutTree(nodes, new Set(), 'horizontal');
  const P = (id: string) => r.placed.get(id)!;
  assert.equal(r.placed.size, 6);
  assert.equal(P('a').y, P('b').y); assert.equal(P('a1').y, P('a2').y);   // a level shares a row
  assert.ok(P('d').y < P('a').y && P('a').y < P('a1').y);
  assert.ok(P('a1').x < P('a2').x && P('a2').x < P('b1').x);                // left to right
  assert.equal(P('a').x, (P('a1').x + P('a2').x) / 2);
  assert.equal(P('d').x, (P('a').x + P('b').x) / 2);
  assert.equal(r.paths.length, 5);
  assert.equal(L.layoutTree(nodes, new Set(['a']), 'horizontal').placed.size, 4);
  const cards = [...r.placed.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const m = cards[i], n = cards[j];
    assert.ok(m.x + L.CARD_W <= n.x || n.x + L.CARD_W <= m.x || m.y + L.CARD_H <= n.y || n.y + L.CARD_H <= m.y);
  }
});

test('project filters: Deltek number, Project Manager, Technical Manager and Client', () => {
  const mk = (id: string, extra: any) => ({ id, name: 'P ' + id, project_no: id, cde: 'ACC', type: 'BIM', built_up_area: 100, status: 'In Progress', ...extra }) as any;
  const projects = [
    mk('a', { deltek_number: 'D-100', project_manager: 'Sara', technical_manager: 'Omar', client: 'Acme' }),
    mk('b', { deltek_number: 'D-200', project_manager: 'Sara', technical_manager: null, client: 'Globex' }),
    mk('c', {}),
  ];
  const ds = { projects, assignments: [] as any[] };
  const base: any = { q: '', manager: [], coordinator: [], member: [], status: [], cde: [], type: [], deltek: [], pm: [], tm: [], client: [], areaMin: null, areaMax: null, dateFrom: null, dateTo: null };
  const ids = (f: any) => m.applyProjectFilters(ds as any, { ...base, ...f }).map((p) => p.id).join();
  assert.equal(ids({}), 'a,b,c');
  assert.equal(ids({ deltek: ['D-200'] }), 'b');
  assert.equal(ids({ pm: ['Sara'] }), 'a,b');
  assert.equal(ids({ tm: ['Omar'] }), 'a');
  assert.equal(ids({ tm: ['(none)'] }), 'b,c');           // projects without a value can be selected
  assert.equal(ids({ client: ['Acme', 'Globex'] }), 'a,b');
  assert.equal(ids({ pm: ['Sara'], client: ['Globex'] }), 'b'); // filters combine
  assert.equal(ids({ q: 'acme' }), 'a');                    // free-text search also covers client
  assert.equal(ids({ q: 'd-200' }), 'b');                   // ...and the Deltek number
});

import { matrixScale, squareWidth, DEFAULT_SQ } from '../lib/metrics.ts';
import { projectWorkload } from '../lib/workload.ts';
test('workload strip: width follows load, default when not calculated', () => {
  const rows = [{ projects: [{ load: 10000 }, { load: 30000 }, { load: null }] }, { projects: [{ load: 5000 }] }];
  const k = matrixScale(rows);
  assert.ok(k > 0);
  assert.equal(squareWidth({ load: null }, k), DEFAULT_SQ);
  assert.ok(squareWidth({ load: 30000 }, k) > 2.9 * squareWidth({ load: 10000 }, k));
  assert.equal(matrixScale([{ projects: [{ load: null }] }]), 0);
});
test('workload formula: area x typicality x function x coordination x BIM standards', () => {
  const b = { built_up_area: 10000, typicality: 'Low Typical', function_type: 'Hospital', coordination_type: 'Design Review', bim_standards: 'Aggressive Standards', scope_items: ['Architecture', 'MEP'] };
  assert.equal(projectWorkload(b), Math.round(10000 * 0.8 * 1.3 * 0.2 * 1.3 * 0.8 * 100) / 100);
  assert.equal(projectWorkload({ ...b, bim_standards: null }), null);
  assert.equal(projectWorkload({ ...b, bim_standards: 'Normal Standards', function_type: 'Villas', typicality: 'No Typical', coordination_type: 'Internal Coordination', scope_items: ['Architecture', 'Structure', 'MEP'] }), 6000);
  assert.equal(projectWorkload({ ...b, scope_items: [] }), null);
  assert.equal(projectWorkload({ ...b, function_type: 'Residential/Offices/Mixed Use/Other', typicality: 'No Typical', coordination_type: 'Internal Coordination', bim_standards: 'Normal Standards', scope_items: ['Lead Consultant'] }), 2000);
  assert.equal(projectWorkload({ ...b, scope_items: null }), null);
  assert.equal(projectWorkload({ ...b, bim_standards: 'Minimum Standards', scope_items: ['Lead Consultant'] }), Math.round(10000 * 0.8 * 1.3 * 0.2 * 0.8 * 0.2 * 100) / 100);
  assert.equal(projectWorkload({ ...b, function_type: 'Landscape', bim_standards: 'Minimum Standards', typicality: 'High Typical', scope_items: ['Architecture', 'Structure', 'MEP'] }), Math.round(10000 * 0.4 * 0.1 * 0.2 * 0.8 * 1.0 * 100) / 100);
  assert.equal(projectWorkload({ ...b, built_up_area: null }), null);
});

import { baseScale, centered, clampOffset, sourceRect, zoomAt } from '../lib/crop.ts';
test('crop geometry: cover, clamp, zoom and source rectangle', () => {
  // 400x200 image in a 100x100 frame: scale 0.5 -> 200x100, centred horizontally
  assert.equal(baseScale(400, 200, 100, 100), 0.5);
  const c = centered(400, 200, 100, 100);
  assert.deepEqual([c.x, c.y], [-50, 0]);
  assert.deepEqual(sourceRect(400, 200, 100, 100, c), { sx: 100, sy: 0, sw: 200, sh: 200 });
  assert.deepEqual(clampOffset(400, 200, 100, 100, 1, 50, 30), { x: 0, y: 0 });      // cannot drag past the edge
  assert.deepEqual(clampOffset(400, 200, 100, 100, 1, -500, -40), { x: -100, y: 0 });
  const z = zoomAt(400, 200, 100, 100, c, 2, 50, 50);                                // zoom around the frame centre
  const r = sourceRect(400, 200, 100, 100, z);
  assert.equal(r.sw, 100); assert.equal(r.sx + r.sw / 2, 200);                       // still centred on the image centre
  assert.equal(zoomAt(400, 200, 100, 100, c, 99, 0, 0).zoom, 5);
  assert.equal(zoomAt(400, 200, 100, 100, c, 0.1, 0, 0).zoom, 1);
});

import { mergeFactors, DEFAULT_FACTORS } from '../lib/workload.ts';
test('editable factors: stored group overrides defaults, custom option works', () => {
  assert.deepEqual(mergeFactors(undefined), DEFAULT_FACTORS);
  const f = mergeFactors({ typicality: { 'No Typical': 2, Custom: 0.5 } });
  assert.equal(f.typicality.Custom, 0.5);
  assert.equal(f.function_type.Hospital, 1.3);
  const b: any = { built_up_area: 1000, typicality: 'Custom', function_type: 'Hospital', coordination_type: 'Internal Coordination', bim_standards: 'Normal Standards', scope_items: ['MEP'] };
  assert.equal(projectWorkload(b, f), Math.round(1000 * 0.5 * 1.3 * 1 * 1 * 0.5 * 100) / 100);
  assert.equal(projectWorkload(b), null);
});

test('workload: buildings part + site part', () => {
  const b: any = { built_up_area: 10000, plot_area: 5000, typicality: 'No Typical', function_type: 'Hospital', coordination_type: 'Internal Coordination', bim_standards: 'Normal Standards', scope_items: ['Architecture'], scope_site: ['Infrastructure', 'Landscape'] };
  const bld = 10000 * 1 * 1.3 * 1 * 1 * 0.3, site = 5000 * 1.3 * 1 * 1 * 0.4;
  assert.equal(projectWorkload(b), Math.round((bld + site) * 100) / 100);
  assert.equal(projectWorkload({ ...b, scope_site: [] }), Math.round(bld * 100) / 100);
  assert.equal(projectWorkload({ ...b, scope_items: [], built_up_area: null }), Math.round(site * 100) / 100);
  assert.equal(projectWorkload({ ...b, plot_area: null }), Math.round(bld * 100) / 100);
  assert.equal(projectWorkload({ ...b, typicality: null }), Math.round(site * 100) / 100);
  assert.equal(projectWorkload({ ...b, coordination_type: null }), null);
  assert.equal(projectWorkload({ ...b, scope_items: null, scope_site: null }), null);
  assert.equal(projectWorkload({ ...b, scope_site: ['Lead Consultant'] }), Math.round((bld + 5000 * 1.3 * 0.2) * 100) / 100);
});
