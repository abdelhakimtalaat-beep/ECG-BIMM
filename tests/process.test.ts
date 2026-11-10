import test from 'node:test';
import assert from 'node:assert/strict';
import { polyHitsBox } from '../lib/processRoute.ts';
import { NODE_BOXES, nodeLayout, viewOf, PREREQS, reworkSet, isRejected, alarmsOf, unmetPrereqs, DIAGRAM_H, DIAGRAM_W, EDGES, LANES, NODES, NODE_KEYS, PROCESS_COLORS, PROCESS_STATUSES, nodeById, nodeSize, PHASES, phaseOf, phaseProgress, progressOf, routeEdge, wrapLabel } from '../lib/processMap.ts';

test('process map: ids unique, every node sits in its lane, every connector joins existing nodes', () => {
  assert.equal(NODE_KEYS.size, NODES.length);
  assert.equal(new Set(EDGES.map((e) => e.id)).size, EDGES.length);
  for (const n of NODES) {
    const l = LANES.find((x) => x.id === n.lane); assert.ok(l, n.id);
    const s = nodeSize(n);
    assert.ok(n.y - s.h / 2 >= l!.y0 && n.y + s.h / 2 <= l!.y1, `${n.id} inside lane ${n.lane}`);
    assert.ok(n.x - s.w / 2 >= 26 && n.x + s.w / 2 <= DIAGRAM_W, `${n.id} inside the sheet`);
  }
  for (const e of EDGES) { assert.ok(nodeById.has(e.from) && nodeById.has(e.to), e.id); assert.notEqual(e.from, e.to); assert.ok(e.dashed === undefined || typeof e.dashed === 'boolean'); }
  assert.ok(DIAGRAM_H >= LANES[LANES.length - 1].y1);
});
test('process map: connectors are orthogonal polylines', () => {
  for (const e of EDGES) {
    const p = routeEdge(e); assert.ok(p.length >= 2, e.id);
    for (let i = 1; i < p.length; i++) assert.ok(p[i][0] === p[i - 1][0] || p[i][1] === p[i - 1][1], `${e.id} segment ${i} is horizontal or vertical`);
  }
});
test('process map: statuses, colours and progress', () => {
  assert.deepEqual([...PROCESS_STATUSES], ['Not Started', 'In Progress', 'On Hold', 'Completed']);
  assert.equal(PROCESS_COLORS['Not Started'], '#8b95a5');
  const p0 = progressOf({}); assert.equal(p0.pct, 0); assert.equal(p0.by['Not Started'], NODES.length);
  const s: any = { bm_bep: { status: 'Completed' }, bm_kickoff: { status: 'In Progress' }, pm_close: { status: 'On Hold' } };
  const p1 = progressOf(s); assert.equal(p1.by.Completed, 1); assert.equal(p1.by['In Progress'], 1); assert.equal(p1.by['On Hold'], 1); assert.equal(p1.by['Not Started'], NODES.length - 3);
});
test('process map: label wrapping', () => {
  assert.deepEqual(wrapLabel('Create BEP', 16), ['Create BEP']);
  assert.deepEqual(wrapLabel('Validate The Architecture Base Model', 14), ['Validate The', 'Architecture', 'Base Model']);
  assert.deepEqual(wrapLabel('Superlongwordwithoutspaces', 5), ['Superlongwordwithoutspaces']);
});

test('process map: MIDP and TIDP follow the BIM Kick-Off, the client MIDP gate sits in Project Management after the teams', () => {
  const x = (id: string) => nodeById.get(id)!.x;
  const g = nodeById.get('pm_midp_gate')!; assert.equal(g.lane, 'pm'); assert.equal(g.kind, 'decision');
  for (const t of ['ar_tidp', 'st_tidp', 'me_tidp', 'in_tidp']) { assert.ok(x(t) > x('bm_kickoff'), t); assert.ok(x(t) < x('bm_midp'), t); assert.ok(EDGES.some((e) => e.from === t && e.to === 'bm_midp')); }
  assert.ok(x('bm_midp') > x('bm_kickoff') && g.x >= x('bm_midp') && x('bm_pinfo') > g.x);
  assert.ok(EDGES.some((e) => e.from === 'bm_midp' && e.to === 'pm_midp_gate') && EDGES.some((e) => e.from === 'pm_midp_gate' && e.to === 'bm_pinfo'));
});
test('process map: four phases cover every node', () => {
  assert.deepEqual(PHASES.map((p) => p.id), ['mob', 'prod', 'coord', 'qc']);
  assert.equal(phaseOf(nodeById.get('pm_midp_gate')!).id, 'mob'); assert.equal(phaseOf(nodeById.get('bm_coord')!).id, 'coord'); assert.equal(phaseOf(nodeById.get('pm_close')!).id, 'qc'); assert.equal(phaseOf(nodeById.get('bm_rcp')!).id, 'prod');
  const pp = phaseProgress({}); assert.equal(pp.reduce((a, b) => a + b.total, 0), NODES.length); assert.ok(pp.every((x) => x.total > 0));
});

test('process map: no connector runs through another node', () => {
  for (const e of EDGES) { const p = routeEdge(e); for (const b of NODE_BOXES) if (b.id !== e.from && b.id !== e.to) assert.ok(!polyHitsBox(p, b, 4), `${e.id} comes within 4 units of ${b.id}`); }
});
test('process map: coordination starts at the published views / NWC files, quality control at the internal review', () => {
  for (const id of ['ar_publish', 'st_publish', 'me_publish', 'in_nwc', 'bm_coord']) assert.equal(phaseOf(nodeById.get(id)!).id, 'coord', id);
  for (const id of ['ar_acquire', 'st_acquire', 'me_acquire', 'ur_master']) assert.equal(phaseOf(nodeById.get(id)!).id, 'prod', id);
  for (const id of ['ar_refine', 'st_resolve']) assert.equal(phaseOf(nodeById.get(id)!).id, 'coord', id);
  for (const id of ['ar_review', 'st_review', 'in_review', 'bm_qcc', 'pm_close']) assert.equal(phaseOf(nodeById.get(id)!).id, 'qc', id);
});
test('process map: alarm when an activity starts before the previous ones are completed', () => {
  assert.deepEqual(PREREQS.get('bm_pinfo')!.sort(), ['ar_keyplan', 'bm_midp', 'pm_midp_gate', 'ur_site'].sort());
  assert.ok(!PREREQS.get('bm_coord')!.includes('bm_appr1'), 'the No (rework) connector is not a prerequisite');
  assert.deepEqual(alarmsOf({}), {});
  const s: any = { bm_bep: { status: 'Completed' }, bm_cde: { status: 'Completed' }, bm_tidpt: { status: 'Completed' }, pm_client: { status: 'Completed' }, bm_kickoff: { status: 'Completed' }, bm_midp: { status: 'In Progress' } };
  const a = alarmsOf(s); assert.ok('bm_midp' in a); assert.deepEqual(a.bm_midp.sort(), ['ar_tidp', 'in_tidp', 'me_tidp', 'st_tidp']);
  assert.ok(!unmetPrereqs({ ...s, bm_midp: { status: 'Completed' } } as any, 'bm_pinfo').includes('bm_midp'));
  for (const id of ['pm_mob', 'ar_consult', 'ar_tidp', 'st_tidp', 'me_tidp', 'in_tidp', 'bm_midp']) s[id] = { status: 'Completed' }; s.bm_midp = { status: 'Completed' };
  assert.deepEqual(alarmsOf(s), {});
  s.bm_pinfo = { status: 'On Hold' }; assert.deepEqual(alarmsOf(s), {}, 'On Hold is not a start');
});

test('a gate answered No: rework set and red state', () => {
  assert.deepEqual(reworkSet('bm_appr1').sort(), ['bm_coord', 'bm_squad', 'bm_visual']);
  assert.ok(reworkSet('ar_review').includes('ar_refine'));
  assert.ok(!reworkSet('ar_review').includes('ar_review'));
  const s: any = { bm_valid2: { status: 'Completed', outcome: 'no' } };
  assert.equal(isRejected(s, 'bm_valid2'), true);
  assert.ok(!('bm_valid2' in alarmsOf(s)));
  assert.equal(isRejected({ bm_valid2: { status: 'In Progress', outcome: 'no' } } as any, 'bm_valid2'), false);
});

test('process map: every label fits its box and no two boxes touch', () => {
  for (const n of NODES) {
    const l = nodeLayout(n); const longest = Math.max(...l.lines.map((t) => t.length)) * 5.4;
    assert.ok(longest <= (n.kind === 'decision' ? l.w * 0.58 : l.w - 12) + 0.5, `${n.id} text fits the width`);
    assert.ok(l.lines.length * 10.1 <= (n.kind === 'decision' ? l.h * 0.5 : l.h - 10) + 0.5, `${n.id} text fits the height`);
    assert.equal(l.lines.join(' '), n.label.split(/\s+/).join(' '));
  }
  for (let i = 0; i < NODE_BOXES.length; i++) for (let j = i + 1; j < NODE_BOXES.length; j++) {
    const a = NODE_BOXES[i], b = NODE_BOXES[j];
    const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
    assert.ok(gap >= 12, `${a.id} and ${b.id} are ${gap.toFixed(0)} apart`);
  }
});
test('process map: a connector never runs through its own boxes', () => {
  for (const e of EDGES) { const p = routeEdge(e); for (const id of [e.from, e.to]) { const b = NODE_BOXES.find((x) => x.id === id)!; assert.ok(!polyHitsBox(p, b, -1), `${e.id} runs through ${id}`); } }
});

test('flow: Requirements -> CDE Setup -> Create BEP -> Kick-Off -> TIDP Template -> MIDP', () => {
  assert.deepEqual(PREREQS.get('bm_cde'), ['pm_mob']);
  assert.deepEqual(PREREQS.get('bm_bep')!.sort(), ['ar_consult', 'bm_cde']);
  assert.deepEqual(PREREQS.get('bm_kickoff')!.sort(), ['bm_bep', 'pm_client']);
  assert.deepEqual(PREREQS.get('bm_tidpt'), ['bm_kickoff']);
  assert.deepEqual(PREREQS.get('ar_tidp'), ['bm_tidpt']);
  assert.ok(PREREQS.get('ar_reflected')!.includes('me_ceil') && !PREREQS.get('bm_rcp')!.includes('me_ceil'));
});
test('removing rows: lanes move up, their activities and connectors disappear, progress ignores them', () => {
  const full = viewOf([]); assert.equal(full.nodes.length, NODES.length); assert.equal(full.height, 795);
  const v = viewOf(['urban', 'infra']);
  assert.ok(!v.lanes.some((l) => l.id === 'urban' || l.id === 'infra'));
  assert.equal(v.height, 795 - 89 - 89);
  assert.equal(v.lanes.find((l) => l.id === 'struct')!.y0, 438);
  assert.ok(v.nodes.every((n) => n.lane !== 'urban' && n.lane !== 'infra'));
  assert.ok(v.edges.every((e) => v.nodes.some((n) => n.id === e.from) && v.nodes.some((n) => n.id === e.to)));
  assert.ok(v.hiddenNodes.has('ur_site') && !v.hiddenNodes.has('bm_bep'));
  for (const n of v.nodes) { const l = v.lanes.find((x) => x.id === n.lane)!; assert.ok(n.y > l.y0 && n.y < l.y1, n.id); }
  for (const e of v.edges) { const p = v.route(e); for (const n of v.nodes) if (n.id !== e.from && n.id !== e.to) assert.ok(!polyHitsBox(p, { id: n.id, x0: n.x - nodeLayout(n).w / 2, x1: n.x + nodeLayout(n).w / 2, y0: n.y - nodeLayout(n).h / 2, y1: n.y + nodeLayout(n).h / 2 }, 4), `${e.id} vs ${n.id}`); }
  assert.equal(progressOf({}, v.hiddenNodes).total, v.nodes.length);
  assert.ok(!('bm_pinfo' in alarmsOf({ bm_pinfo: { status: 'In Progress' } } as any, v.hiddenNodes)) || !alarmsOf({ bm_pinfo: { status: 'In Progress' } } as any, v.hiddenNodes).bm_pinfo.includes('ur_site'));
  assert.equal(viewOf(LANES.map((l) => l.id)).nodes.length, NODES.length, 'never hides every row');
});
