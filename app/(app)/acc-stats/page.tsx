'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartBox, VBar } from '@/components/charts';
import { Empty, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';

type By = Record<string, number>;
interface Asg { key: string; name: string; kind: 'role' | 'user' | 'company' | 'none'; total: number; by_status: By }
interface Loc { key: string; name: string; building: string; total: number; by_status: By }
interface Cell { building: string; key: string; by_status: By }
interface Proj { id: string; name: string; project_no: string | null; acc_project_id: string; synced_at: string; assignees: Asg[] | null; locations: Loc[] | null; matrix: Cell[] | null; total: number }
const COLS: [string, string, string][] = [['open', 'Open', '#F59E0B'], ['in_dispute', 'In dispute', '#DC2626'], ['draft', 'Draft', '#94A3B8'], ['completed', 'Completed', '#0EA5E9'], ['closed', 'Closed', '#16A34A'], ['not_approved', 'Not approved', '#7C3AED']];
const KIND: Record<string, string> = { role: 'Role', user: 'Person', company: 'Company', none: '—' };
const sum = (m: By) => Object.values(m).reduce((s, v) => s + v, 0);
const other = (m: By) => sum(m) - COLS.reduce((s, [k]) => s + (m[k] ?? 0), 0);
const series = [...COLS.map(([, l]) => l), 'Other']; const colors = [...COLS.map(([, , c]) => c), '#CBD5E1'];
const row = (name: string, m: By) => ({ name, ...Object.fromEntries(COLS.map(([k, l]) => [l, m[k] ?? 0])), Other: other(m) });
/** A chart that keeps every bar readable: it scrolls sideways when there are many. */
const Wide = ({ n, children }: { n: number; children: React.ReactNode }) => <div className="h-full overflow-x-auto"><div className="h-full" style={{ minWidth: Math.max(560, n * 72) }}>{children}</div></div>;

export default function AccStatsPage() {
  const toast = useToast(); const [rows, setRows] = useState<Proj[] | null>(null); const [sel, setSel] = useState(''); const [kind, setKind] = useState('all'); const [view, setView] = useState<'assignee' | 'location'>('assignee'); const [bld, setBld] = useState('all');
  useEffect(() => { api<{ projects: Proj[] }>('/api/acc/assignees').then((r) => { setRows(r.projects); setSel(r.projects[0]?.id ?? ''); }).catch((e) => { toast(e.message, 'err'); setRows([]); }); }, [toast]);
  useEffect(() => { setBld('all'); }, [sel]);
  const p = rows?.find((x) => x.id === sel);
  const buildings = useMemo(() => [...new Set([...(p?.matrix ?? []).map((c) => c.building), ...(p?.locations ?? []).map((l) => l.building)])].sort((a, b) => (a === 'No location' ? 1 : 0) - (b === 'No location' ? 1 : 0) || a.localeCompare(b)), [p]);
  // every assignee of the project, with the counts of the chosen building (zeros included)
  const asg = useMemo(() => {
    if (!p?.assignees) return [];
    const inB = new Map<string, By>(); for (const c of p.matrix ?? []) if (bld === 'all' || c.building === bld) { const m: By = inB.get(c.key) ?? {}; for (const [k, v] of Object.entries(c.by_status)) m[k] = (m[k] ?? 0) + Number(v); inB.set(c.key, m); }
    return p.assignees.filter((a) => kind === 'all' || a.kind === kind).map((a) => { const m = bld === 'all' ? a.by_status : inB.get(a.key) ?? {}; return { ...a, by_status: m, total: sum(m) }; }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [p, bld, kind]);
  const locs = useMemo(() => (p?.locations ?? []).filter((l) => bld === 'all' || l.building === bld), [p, bld]);
  if (!rows) return <Spinner />;
  const needMatrix = bld !== 'all' && view === 'assignee' && !p?.matrix;
  const shown = asg.reduce((s, a) => s + a.total, 0);
  return (
    <div className="space-y-4">
      <PageHeader title="ACC Statistics" subtitle="Issues status by assignee or by location, from the ACC extract" />
      {rows.length === 0 ? <Empty title="No ACC statistics yet" hint="The administrator uploads an ACC extract (Administration > ACC) and links the project to its ACC project." /> : <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Project</span><select className="input w-80" value={sel} onChange={(e) => setSel(e.target.value)}>{rows.map((x) => <option key={x.id} value={x.id}>{x.project_no ? `${x.project_no} — ` : ''}{x.name}</option>)}</select></label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm" role="tablist" aria-label="View">{([['assignee', 'By assignee'], ['location', 'By location']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`px-3 py-2 ${view === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`} onClick={() => setView(k)}>{l}</button>)}</div>
          {p && <p className="pb-2 text-xs text-slate-500">{p.total} issues · extract of {fmtDate(p.synced_at)} (not live)</p>}
        </div>
        {p && <section className="card flex flex-wrap items-end gap-4 p-3" aria-label="Filters">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Location filter (building / area)</span><select className="input w-64" value={bld} onChange={(e) => setBld(e.target.value)}><option value="all">All locations</option>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
          {view === 'assignee' && <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Assigned to</span><select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Everyone</option><option value="role">Roles</option><option value="user">People</option></select></label>}
          <p className="pb-2 text-xs text-slate-500">{view === 'assignee' ? `Every assignee is listed${bld === 'all' ? '' : `; the numbers are the issues located in “${bld}”`}.` : 'The location filter limits the locations listed.'}</p>
        </section>}
        {p && view === 'location' && (p.locations ? <>
          {(() => { const withLoc = p.locations.filter((l) => l.key !== '-' && l.building !== 'Unknown location').reduce((s, l) => s + l.total, 0); return <p className="text-xs text-amber-700">Only {withLoc} of {p.total} issues have a location in ACC; the rest are listed as “No location”.</p>; })()}
          <ChartBox title="Issues by location and status" subtitle={`${locs.length} location(s)`} height={320}><Wide n={locs.length}><VBar data={locs.map((a) => row(a.name, a.by_status))} series={series} colors={colors} /></Wide></ChartBox>
          <div className="card overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Location</th>{COLS.map(([, l]) => <th key={l} className="p-2 text-right">{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{locs.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a.by_status)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
        </> : <Empty title="This project's statistics do not include locations" hint="Upload a new ACC extract (Administration > ACC) to add them." />)}
        {p && view === 'assignee' && !p.assignees && <Empty title="This project's statistics do not include assignees" hint="Upload a new ACC extract (Administration > ACC) to add them." />}
        {p?.assignees && view === 'assignee' && (needMatrix ? <Empty title="Upload the extract again to filter assignees by location" hint="The current import does not contain the assignee-by-location figures (Administration > ACC)." /> : <>
          <ChartBox title="Issues by assignee and status" subtitle={`${asg.length} assignee(s)${bld === 'all' ? '' : ` · location: ${bld} · ${shown} issues`}`} height={340}><Wide n={asg.length}><VBar data={asg.map((a) => row(a.name, a.by_status))} series={series} colors={colors} /></Wide></ChartBox>
          <div className="card overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Assignee</th><th className="p-2">Type</th>{COLS.map(([, l]) => <th key={l} className="p-2 text-right">{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{asg.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td><td className="p-2 text-slate-500">{KIND[a.kind]}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a.by_status)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-500"><BarChart3 className="mr-1 inline" size={12} />Most issues are assigned to ACC roles (groups), so those rows are shown as roles; people appear when an issue is assigned to a named person.</p>
        </>)}
      </>}
    </div>);
}
