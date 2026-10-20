// Org chart layouts (pure; unit tested).
// 'side' (default): left-to-right tree. The department manager is on the left, the next level is a column to its right,
//   and each manager's team is a column further right, each person on their own row.
// 'horizontal': classic top-down tree. Each level is one row, so siblings sit side by side and the chart spreads sideways.
// 'vertical': top-down "hanging" tree. Every level hangs under its manager, indented, as one tall narrow column.
export interface LNode { id: string; reports_to: string | null }
export interface Placed { id: string; x: number; y: number; depth: number; children: string[] }
export interface Link { p: string; c: string; d: string }
export const CARD_W = 300, CARD_H = 144, GAP_X = 36, GAP_Y = 64, STACK_GAP = 24, INDENT = 56, TRUNK = 26, GAP_SIDE = 72, ROW_GAP = 22;

function index(nodes: LNode[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.reports_to && ids.has(n.reports_to)) { const l = kids.get(n.reports_to); if (l) l.push(n.id); else kids.set(n.reports_to, [n.id]); }
    else roots.push(n.id);
  }
  return { kids, roots };
}

// Left-to-right tree: depth runs along x, leaves take consecutive rows, parents are centred on their reports.
function layoutSide(nodes: LNode[], collapsed: Set<string>) {
  const { kids, roots } = index(nodes);
  const placed = new Map<string, Placed>();
  const paths: Link[] = [];
  const seen = new Set<string>();
  const ROW = CARD_H + ROW_GAP;
  let slot = 0;
  const visit = (id: string, depth: number): number => { // returns the card's centre y
    seen.add(id);
    const ch = (collapsed.has(id) ? [] : kids.get(id) ?? []).filter((k) => !seen.has(k));
    const used: string[] = [];
    const cys: number[] = [];
    for (const c of ch) { if (seen.has(c)) continue; cys.push(visit(c, depth + 1)); used.push(c); }
    let cy: number;
    if (!used.length) { cy = slot * ROW + CARD_H / 2; slot++; } else cy = (cys[0] + cys[cys.length - 1]) / 2;
    const me: Placed = { id, x: depth * (CARD_W + GAP_SIDE), y: cy - CARD_H / 2, depth, children: used };
    placed.set(id, me);
    used.forEach((c, i) => {
      const x1 = me.x + CARD_W, mx = x1 + GAP_SIDE / 2, x2 = placed.get(c)!.x;
      paths.push({ p: id, c, d: `M${x1},${cy} L${mx},${cy} L${mx},${cys[i]} L${x2},${cys[i]}` });
    });
    return cy;
  };
  for (const r of roots) { if (!seen.has(r)) { visit(r, 0); slot += 0.5; } }
  const all = [...placed.values()];
  return { placed, paths, kids, width: all.length ? Math.max(...all.map((p) => p.x)) + CARD_W : 0, height: all.length ? Math.max(...all.map((p) => p.y)) + CARD_H : 0 };
}

// Classic horizontal tree: levels are rows, leaves take consecutive columns, parents are centred over their reports.
function layoutHorizontal(nodes: LNode[], collapsed: Set<string>) {
  const { kids, roots } = index(nodes);
  const placed = new Map<string, Placed>();
  const paths: Link[] = [];
  const seen = new Set<string>();
  let slot = 0;
  const visit = (id: string, depth: number): number => { // returns the card's centre x
    seen.add(id);
    const ch = (collapsed.has(id) ? [] : kids.get(id) ?? []).filter((k) => !seen.has(k));
    const used: string[] = [], cxs: number[] = [];
    for (const c of ch) { if (seen.has(c)) continue; cxs.push(visit(c, depth + 1)); used.push(c); }
    let cx: number;
    if (!used.length) { cx = slot * (CARD_W + GAP_X) + CARD_W / 2; slot++; } else cx = (cxs[0] + cxs[cxs.length - 1]) / 2;
    const me: Placed = { id, x: cx - CARD_W / 2, y: depth * (CARD_H + GAP_Y), depth, children: used };
    placed.set(id, me);
    used.forEach((c, i) => {
      const y1 = me.y + CARD_H, my = y1 + GAP_Y / 2, y2 = placed.get(c)!.y;
      paths.push({ p: id, c, d: `M${cx},${y1} L${cx},${my} L${cxs[i]},${my} L${cxs[i]},${y2}` });
    });
    return cx;
  };
  for (const r of roots) { if (!seen.has(r)) { visit(r, 0); slot += 0.5; } }
  const all = [...placed.values()];
  return { placed, paths, kids, width: all.length ? Math.max(...all.map((p) => p.x)) + CARD_W : 0, height: all.length ? Math.max(...all.map((p) => p.y)) + CARD_H : 0 };
}

// Fully vertical tree: each person on its own row, reports indented underneath, joined by a trunk line.
function layoutVertical(nodes: LNode[], collapsed: Set<string>) {
  const { kids, roots } = index(nodes);
  const placed = new Map<string, Placed>();
  const paths: Link[] = [];
  const seen = new Set<string>();
  let y = 0;
  const visit = (id: string, depth: number) => {
    seen.add(id);
    const ch = collapsed.has(id) ? [] : (kids.get(id) ?? []).filter((k) => !seen.has(k));
    const me: Placed = { id, x: depth * INDENT, y, depth, children: [] };
    placed.set(id, me);
    y += CARD_H + STACK_GAP;
    for (const c of ch) {
      if (seen.has(c)) continue;
      visit(c, depth + 1);
      const cp = placed.get(c)!; me.children.push(c);
      const tx = me.x + TRUNK, cy = cp.y + CARD_H / 2;
      paths.push({ p: id, c, d: `M${tx},${me.y + CARD_H} L${tx},${cy} L${cp.x},${cy}` });
    }
  };
  for (const r of roots) { if (!seen.has(r)) { visit(r, 0); y += GAP_Y - STACK_GAP; } }
  const all = [...placed.values()];
  return { placed, paths, kids, width: all.length ? Math.max(...all.map((p) => p.x)) + CARD_W : 0, height: all.length ? Math.max(...all.map((p) => p.y)) + CARD_H : 0 };
}

export type OrgMode = 'side' | 'vertical' | 'horizontal';
export function layoutTree(nodes: LNode[], collapsed: Set<string>, mode: OrgMode = 'side') {
  return mode === 'vertical' ? layoutVertical(nodes, collapsed) : mode === 'horizontal' ? layoutHorizontal(nodes, collapsed) : layoutSide(nodes, collapsed);
}
export function descendants(kids: Map<string, string[]>, id: string): string[] {
  const out: string[] = []; const st = [...(kids.get(id) ?? [])];
  while (st.length) { const c = st.pop()!; out.push(c); st.push(...(kids.get(c) ?? [])); }
  return out;
}
