// Org chart layouts (pure; unit tested).
// 'vertical' (default): every level hangs under its manager, indented, so the chart is one tall narrow column.
// 'columns': managers that have their own team sit side by side; people with no visible reports are stacked in a column
// under their manager, joined by a trunk line. This keeps the chart narrow and tall so the text can stay large.
export interface LNode { id: string; reports_to: string | null }
export interface Placed { id: string; x: number; y: number; depth: number; children: string[] }
export interface Link { p: string; c: string; d: string }
export const CARD_W = 300, CARD_H = 144, GAP_X = 40, GAP_Y = 64, STACK_GAP = 24, INDENT = 56, TRUNK = 26;

type Pt = [number, number];
interface Block { w: number; pos: Map<string, { x: number; y: number; depth: number }>; links: { p: string; c: string; pts: Pt[] }[]; rootCx: number; kids: string[] }

function shift(b: Block, dx: number, dy: number) {
  for (const v of b.pos.values()) { v.x += dx; v.y += dy; }
  for (const l of b.links) for (const pt of l.pts) { pt[0] += dx; pt[1] += dy; }
  b.rootCx += dx;
}

function layoutColumns(nodes: LNode[], collapsed: Set<string>) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.reports_to && ids.has(n.reports_to)) { const l = kids.get(n.reports_to); if (l) l.push(n.id); else kids.set(n.reports_to, [n.id]); }
    else roots.push(n.id);
  }
  const seen = new Set<string>();
  const hasVisibleKids = (id: string) => !collapsed.has(id) && (kids.get(id) ?? []).length > 0;

  const build = (id: string, depth: number): Block => {
    seen.add(id);
    const all = collapsed.has(id) ? [] : (kids.get(id) ?? []).filter((k) => !seen.has(k));
    if (!all.length) return { w: CARD_W, pos: new Map([[id, { x: 0, y: 0, depth }]]), links: [], rootCx: CARD_W / 2, kids: [] };
    const leaves = all.filter((k) => !hasVisibleKids(k));
    const branches = all.filter((k) => hasVisibleKids(k));
    const y0 = CARD_H + GAP_Y, busY = CARD_H + GAP_Y / 2;
    const pos: Block['pos'] = new Map();
    const conns: { c: string; dropX: number; end: Pt[]; leaf: boolean }[] = [];
    let x = 0;
    if (leaves.length) {
      leaves.forEach((lf, i) => {
        const lx = x + INDENT, ly = y0 + i * (CARD_H + STACK_GAP);
        seen.add(lf); pos.set(lf, { x: lx, y: ly, depth: depth + 1 });
        conns.push({ c: lf, dropX: x + TRUNK, end: [[x + TRUNK, ly + CARD_H / 2], [lx, ly + CARD_H / 2]], leaf: true });
      });
      x += INDENT + CARD_W + GAP_X;
    }
    const links: Block['links'] = [];
    for (const b of branches) {
      if (seen.has(b)) continue;
      const bb = build(b, depth + 1);
      shift(bb, x, y0);
      for (const [k, v] of bb.pos) pos.set(k, v);
      links.push(...bb.links);
      conns.push({ c: b, dropX: bb.rootCx, end: [[bb.rootCx, y0]], leaf: false });
      x += bb.w + GAP_X;
    }
    let W = x - GAP_X;
    const onlyLeaves = conns.every((c) => c.leaf);
    const drops = conns.map((c) => c.dropX);
    let cardX = onlyLeaves ? 0 : (Math.min(...drops) + Math.max(...drops)) / 2 - CARD_W / 2;
    const off = Math.max(0, -cardX);
    if (off) {
      for (const v of pos.values()) v.x += off;
      for (const l of links) for (const pt of l.pts) pt[0] += off;
      for (const c of conns) { c.dropX += off; for (const pt of c.end) pt[0] += off; }
      cardX += off; W += off;
    }
    const pcx = onlyLeaves ? cardX + TRUNK : cardX + CARD_W / 2;
    for (const c of conns) {
      const pts: Pt[] = onlyLeaves ? [[pcx, CARD_H], ...c.end.slice(0)] : [[pcx, CARD_H], [pcx, busY], [c.dropX, busY], ...c.end.map((p) => [...p] as Pt)];
      links.push({ p: id, c: c.c, pts: pts.map((p) => [p[0], p[1]] as Pt) });
    }
    pos.set(id, { x: cardX, y: 0, depth });
    return { w: Math.max(W, cardX + CARD_W), pos, links, rootCx: cardX + CARD_W / 2, kids: all };
  };

  const placed = new Map<string, Placed>();
  const paths: Link[] = [];
  let ox = 0, height = 0;
  for (const r of roots) {
    if (seen.has(r)) continue;
    const b = build(r, 0);
    shift(b, ox, 0);
    for (const [id, v] of b.pos) { placed.set(id, { id, x: v.x, y: v.y, depth: v.depth, children: [] }); height = Math.max(height, v.y + CARD_H); }
    for (const l of b.links) paths.push({ p: l.p, c: l.c, d: 'M' + l.pts.map((p) => `${p[0]},${p[1]}`).join(' L') });
    ox += b.w + GAP_X;
  }
  for (const l of paths) placed.get(l.p)?.children.push(l.c);
  const width = placed.size ? Math.max(...[...placed.values()].map((p) => p.x)) + CARD_W : 0;
  return { placed, width, height, kids, paths };
}

export function descendants(kids: Map<string, string[]>, id: string): string[] {
  const out: string[] = []; const st = [...(kids.get(id) ?? [])];
  while (st.length) { const c = st.pop()!; out.push(c); st.push(...(kids.get(c) ?? [])); }
  return out;
}

// Fully vertical tree: each person on its own row, reports indented underneath, joined by a trunk line.
function layoutVertical(nodes: LNode[], collapsed: Set<string>) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.reports_to && ids.has(n.reports_to)) { const l = kids.get(n.reports_to); if (l) l.push(n.id); else kids.set(n.reports_to, [n.id]); }
    else roots.push(n.id);
  }
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

export type OrgMode = 'vertical' | 'columns';
export function layoutTree(nodes: LNode[], collapsed: Set<string>, mode: OrgMode = 'vertical') {
  return mode === 'columns' ? layoutColumns(nodes, collapsed) : layoutVertical(nodes, collapsed);
}
