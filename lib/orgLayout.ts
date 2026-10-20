// Tidy top-down tree layout for the org chart (pure; unit tested). Leaves get consecutive slots, parents are centred over children.
export interface LNode { id: string; reports_to: string | null }
export interface Placed { id: string; x: number; y: number; depth: number; children: string[] }
export const CARD_W = 208, CARD_H = 108, GAP_X = 28, GAP_Y = 64;

export function layoutTree(nodes: LNode[], collapsed: Set<string>) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.reports_to && ids.has(n.reports_to)) { const l = kids.get(n.reports_to); if (l) l.push(n.id); else kids.set(n.reports_to, [n.id]); }
    else roots.push(n.id);
  }
  const placed = new Map<string, Placed>();
  let slot = 0;
  const visit = (id: string, depth: number, seen: Set<string>): number => {
    if (seen.has(id)) return slot;
    seen.add(id);
    const ch = collapsed.has(id) ? [] : kids.get(id) ?? [];
    let x: number;
    if (!ch.length) { x = slot * (CARD_W + GAP_X); slot++; }
    else { const xs = ch.map((c) => visit(c, depth + 1, seen)); x = (xs[0] + xs[xs.length - 1]) / 2; }
    placed.set(id, { id, x, y: depth * (CARD_H + GAP_Y), depth, children: ch });
    return x;
  };
  const seen = new Set<string>();
  for (const r of roots) visit(r, 0, seen);
  const all = [...placed.values()];
  const width = all.length ? Math.max(...all.map((p) => p.x)) + CARD_W : 0;
  const height = all.length ? Math.max(...all.map((p) => p.y)) + CARD_H : 0;
  return { placed, width, height, kids };
}
export function descendants(kids: Map<string, string[]>, id: string): string[] {
  const out: string[] = []; const st = [...(kids.get(id) ?? [])];
  while (st.length) { const c = st.pop()!; out.push(c); st.push(...(kids.get(c) ?? [])); }
  return out;
}
