// Orthogonal connector router for the BIM Process Map: finds polylines that never pass through another node.
// Pure (no imports) so it can be unit tested. A* over a sparse grid built from the node edges and a regular lattice.
export type Pt = [number, number];
export interface Box { id: string; x0: number; y0: number; x1: number; y1: number }

const lower = (a: number[], v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
const upper = (a: number[], v: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; };

/** True when the polyline passes through the inside of the box (grown by `pad`). Touching the border is allowed. */
export function polyHitsBox(pts: Pt[], b: Box, pad = 0): boolean {
  const x0 = b.x0 - pad, x1 = b.x1 + pad, y0 = b.y0 - pad, y1 = b.y1 + pad;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if (ay === by) { if (ay > y0 && ay < y1 && Math.max(Math.min(ax, bx), x0) < Math.min(Math.max(ax, bx), x1)) return true; }
    else if (ax === bx) { if (ax > x0 && ax < x1 && Math.max(Math.min(ay, by), y0) < Math.min(Math.max(ay, by), y1)) return true; }
    else return true; // a diagonal is never allowed
  }
  return false;
}
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1][0] === p[0] && out[out.length - 1][1] === p[1]) continue;
    out.push(p);
    while (out.length >= 3) { const [a, b, c] = out.slice(-3); if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) out.splice(out.length - 2, 1); else break; }
  }
  return out;
}

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const BEND = 18, RING = 4, PAD = 7, SELF_PAD = 1.5;

export class Router {
  boxes: Box[]; width: number; height: number;
  xs: number[]; ys: number[]; NX: number; NY: number; hb: Int16Array; vb: Int16Array;
  private g: Float32Array; private par: Int32Array;
  constructor(boxes: Box[], width: number, height: number, lattice = 14) {
    this.boxes = boxes; this.width = width; this.height = height;
    const X = new Set<number>(), Y = new Set<number>();
    for (let x = 38; x < width; x += lattice) X.add(x);
    for (let y = 4; y < height; y += lattice) Y.add(y);
    for (const b of boxes) {
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      for (const x of [b.x0 - RING, b.x0, cx, b.x1, b.x1 + RING]) if (x > 36 && x < width - 2) X.add(x);
      for (const y of [b.y0 - RING, b.y0, cy, b.y1, b.y1 + RING]) if (y > 2 && y < height - 2) Y.add(y);
    }
    this.xs = [...X].sort((a, b) => a - b); this.ys = [...Y].sort((a, b) => a - b); this.NX = this.xs.length; this.NY = this.ys.length;
    this.hb = new Int16Array((this.NX - 1) * this.NY); this.vb = new Int16Array(this.NX * (this.NY - 1));
    for (const b of boxes) this.apply(b, PAD, 1);
    this.g = new Float32Array(this.NX * this.NY * 4); this.par = new Int32Array(this.NX * this.NY * 4);
  }
  private apply(b: Box, pad: number, d: number) {
    const { xs, ys, NX, NY } = this; const x0 = b.x0 - pad, x1 = b.x1 + pad, y0 = b.y0 - pad, y1 = b.y1 + pad;
    const j0 = upper(ys, y0), j1 = lower(ys, y1) - 1, i0 = Math.max(0, upper(xs, x0) - 1), i1 = Math.min(NX - 2, lower(xs, x1) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.hb[j * (NX - 1) + i] += d;
    const ci0 = upper(xs, x0), ci1 = lower(xs, x1) - 1, cj0 = Math.max(0, upper(ys, y0) - 1), cj1 = Math.min(NY - 2, lower(ys, y1) - 1);
    for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) this.vb[i * (NY - 1) + j] += d;
  }
  private free(i: number, j: number, d: number): boolean {
    const { NX, NY } = this;
    if (d === 0) return i < NX - 1 && this.hb[j * (NX - 1) + i] === 0;
    if (d === 2) return i > 0 && this.hb[j * (NX - 1) + i - 1] === 0;
    if (d === 1) return j < NY - 1 && this.vb[i * (NY - 1) + j] === 0;
    return j > 0 && this.vb[i * (NY - 1) + j - 1] === 0;
  }
  /** Route from box `a` to box `b`: leaves a side of a, enters a side of b, never crosses another box. Null when no route exists. */
  route(a: Box, b: Box): Pt[] | null {
    const { xs, ys, NX, NY } = this;
    for (const k of [a, b]) { this.apply(k, PAD, -1); this.apply(k, SELF_PAD, 1); }
    try {
      const ports = (k: Box) => { const cx = (k.x0 + k.x1) / 2, cy = (k.y0 + k.y1) / 2; return [
        { p: [k.x1, cy] as Pt, r: [k.x1 + RING, cy] as Pt, d: 0 }, { p: [cx, k.y1] as Pt, r: [cx, k.y1 + RING] as Pt, d: 1 },
        { p: [k.x0, cy] as Pt, r: [k.x0 - RING, cy] as Pt, d: 2 }, { p: [cx, k.y0] as Pt, r: [cx, k.y0 - RING] as Pt, d: 3 }]; };
      const idx = (p: Pt) => { const i = lower(xs, p[0]), j = lower(ys, p[1]); return i < NX && j < NY && xs[i] === p[0] && ys[j] === p[1] ? [i, j] : null; };
      const others = this.boxes.filter((k) => k.id !== a.id && k.id !== b.id);
      const stubOk = (p: Pt, r: Pt) => !others.some((o) => polyHitsBox([p, r], o, 2));
      const goals: { i: number; j: number; d: number; pt: Pt; port: Pt }[] = [];
      for (const q of ports(b)) { const ij = idx(q.r); if (ij && stubOk(q.p, q.r)) goals.push({ i: ij[0], j: ij[1], d: (q.d + 2) % 4, pt: q.r, port: q.p }); }
      if (!goals.length) return null;
      this.g.fill(Infinity); const heap: [number, number][] = []; // [f, state]
      const push = (f: number, s: number) => { heap.push([f, s]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      const hfn = (i: number, j: number) => { let m = Infinity; for (const g of goals) m = Math.min(m, Math.abs(xs[i] - g.pt[0]) + Math.abs(ys[j] - g.pt[1])); return m; };
      const starts: { s: number; port: Pt; pt: Pt }[] = [];
      for (const q of ports(a)) { const ij = idx(q.r); if (!ij || !stubOk(q.p, q.r)) continue; const s = (ij[1] * NX + ij[0]) * 4 + q.d; this.g[s] = 0; this.par[s] = -1; starts.push({ s, port: q.p, pt: q.r }); push(hfn(ij[0], ij[1]), s); }
      let end = -1;
      while (heap.length) {
        const [, s] = pop(); const d = s & 3, v = s >> 2, i = v % NX, j = (v / NX) | 0; const cost = this.g[s];
        if (goals.some((g) => g.i === i && g.j === j && g.d === d)) { end = s; break; }
        // keep straight
        if (this.free(i, j, d)) { const ni = i + DX[d], nj = j + DY[d]; const ns = (nj * NX + ni) * 4 + d; const c = cost + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]); if (c < this.g[ns]) { this.g[ns] = c; this.par[ns] = s; push(c + hfn(ni, nj), ns); } }
        // turn
        for (const t of [1, 3]) { const nd = (d + t) & 3; const ns = v * 4 + nd; const c = cost + BEND; if (c < this.g[ns]) { this.g[ns] = c; this.par[ns] = s; push(c + hfn(i, j), ns); } }
      }
      if (end < 0) return null;
      const chain: number[] = []; for (let s = end; s >= 0; s = this.par[s]) chain.push(s); chain.reverse();
      const pts: Pt[] = chain.map((s) => { const v = s >> 2; return [xs[v % NX], ys[(v / NX) | 0]] as Pt; });
      const st = starts.find((x) => x.s === chain[0])!; const gl = goals.find((g) => g.i === (chain[chain.length - 1] >> 2) % NX && g.j === (((chain[chain.length - 1] >> 2) / NX) | 0) && g.d === (chain[chain.length - 1] & 3))!;
      return simplify([st.port, ...pts, gl.port]);
    } finally { for (const k of [a, b]) { this.apply(k, SELF_PAD, -1); this.apply(k, PAD, 1); } }
  }
}
