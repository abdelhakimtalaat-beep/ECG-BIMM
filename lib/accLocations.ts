// ACC Locations (the project's location breakdown: buildings, levels, areas) -> project contents. Pure; unit tested. No imports on purpose.
export interface LNode { id: string; parentId?: string | null; type?: string | null; name?: string | null; order?: number | null }
export interface LItem { id: string; name: string; depth: 1 | 2; parent: string | null }
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const byOrder = (a: LNode, b: LNode) => (a.order ?? 0) - (b.order ?? 0) || clean(a.name).localeCompare(clean(b.name), undefined, { numeric: true });
/** The first level (the nodes under the root: usually buildings or zones) or the first two levels (buildings and their floors/areas). A second-level item is named "Parent - Child" so it stays clear and unique in the project contents. */
export function locationItems(nodes: LNode[], depth: 1 | 2): LItem[] {
  const seen = new Set<string>(); const all = nodes.filter((n) => n && n.id && !seen.has(n.id) && (seen.add(n.id), true));
  const roots = new Set(all.filter((n) => String(n.type ?? '').toLowerCase() === 'root' || !n.parentId).map((n) => n.id));
  const kids = (ids: Set<string>) => all.filter((n) => n.parentId && ids.has(n.parentId) && !roots.has(n.id) && clean(n.name)).sort(byOrder);
  const l1 = kids(roots); const out: LItem[] = [];
  const l2 = depth === 2 ? kids(new Set(l1.map((n) => n.id))) : [];
  for (const a of l1) {
    out.push({ id: a.id, name: clean(a.name).slice(0, 120), depth: 1, parent: null });
    for (const b of l2.filter((x) => x.parentId === a.id)) out.push({ id: b.id, name: `${clean(a.name)} - ${clean(b.name)}`.slice(0, 120), depth: 2, parent: clean(a.name) });
  }
  return out;
}
