import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAGRAM_H, DIAGRAM_W, EDGES, LANES, NODES, NODE_KEYS, PROCESS_COLORS, PROCESS_STATUSES, nodeById, nodeSize, PHASES, phaseOf, phaseProgress, progressOf, routeEdge, wrapLabel } from '../lib/processMap.ts';

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
    const p = routeEdge(e); assert.ok(p.length >= 2 && p.length <= 4, e.id);
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
