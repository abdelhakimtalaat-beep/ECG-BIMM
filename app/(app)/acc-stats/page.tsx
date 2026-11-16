'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartBox, VBar } from '@/components/charts';
import { Empty, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';

interface Asg { key: string; name: string; kind: 'role' | 'user' | 'company' | 'none'; total: number; by_status: Record<string, number> }
interface Loc { key: string; name: string; building: string; total: number; by_status: Record<string, number> }
interface Proj { id: string; name: string; project_no: string | null; acc_project_id: string; synced_at: string; assignees: Asg[] | null; locations: Loc[] | null; total: number }
const COLS: [string, string, string][] = [['open', 'Open', '#F59E0B'], ['in_dispute', 'In dispute', '#DC2626'], ['draft', 'Draft', '#94A3B8'], ['completed', 'Completed', '#0EA5E9'], ['closed', 'Closed', '#16A34A'], ['not_approved', 'Not approved', '#7C3AED']];
const KIND: Record<string, string> = { role: 'Role', user: 'Person', company: 'Company', none: '—' };

export default function AccStatsPage() {
  const toast = useToast(); const [rows, setRows] = useState<Proj[] | null>(null); const [sel, setSel] = useState(''); const [kind, setKind] = useState('all'); const [view, setView] = useState<'assignee' | 'location'>('assignee'); const [bld, setBld] = useState('all');
  useEffect(() => { api<{ projects: Proj[] }>('/api/acc/assignees').then((r) => { setRows(r.projects); setSel(r.projects[0]?.id ?? ''); }).catch((e) => { toast(e.message, 'err'); setRows([]); }); }, [toast]);
  const p = rows?.find((x) => x.id === sel);
  const list = useMemo(() => (p?.assignees ?? []).filter((a) => kind === 'all' || a.kind === kind), [p, kind]);
  const buildings = useMemo(() => [...new Set((p?.locations ?? []).map((l) => l.building))], [p]);
  const locs = useMemo(() => (p?.locations ?? []).filter((l) => bld === 'all' || l.building === bld), [p, bld]);
  useEffect(() => { setBld('all'); }, [sel]);
  if (!rows) return <Spinner />;
  const other = (a: { total: number; by_status: Record<string, number> }) => a.total - COLS.reduce((s, [k]) => s + (a.by_status[k] ?? 0), 0);
  return (
    <div className="space-y-4">
      <PageHeader title="ACC Statistics" subtitle="Issues status by assignee or by location, from the ACC extract" />
      {rows.length === 0 ? <Empty title="No ACC statistics yet" hint="The administrator uploads an ACC extract (Administration > ACC) and links the project to its ACC project." /> : <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Project</span><select className="input w-80" value={sel} onChange={(e) => setSel(e.target.value)}>{rows.map((x) => <option key={x.id} value={x.id}>{x.project_no ? `${x.project_no} — ` : ''}{x.name}</option>)}</select></label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm" role="tablist" aria-label="View">{([['assignee', 'By assignee'], ['location', 'By location']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`px-3 py-2 ${view === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`} onClick={() => setView(k)}>{l}</button>)}</div>
          {view === 'location' && <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Building / area</span><select className="input w-56" value={bld} onChange={(e) => setBld(e.target.value)}><option value="all">All locations</option>{buildings.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>}
          {view === 'assignee' && <label className="text-sm"><span className="mb-1 block text-xs font-medium text-slate-600">Assigned to</span><select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Everyone</option><option value="role">Roles</option><option value="user">People</option></select></label>}
          {p && <p className="pb-2 text-xs text-slate-500">{p.total} issues · extract of {fmtDate(p.synced_at)} (not live)</p>}
        </div>
        {p && view === 'location' && (p.locations ? <>
          {(() => { const withLoc = p.locations.filter((l) => l.key !== '-' && l.building !== 'Unknown location').reduce((s, l) => s + l.total, 0); return <p className="text-xs text-amber-700">Only {withLoc} of {p.total} issues have a location in ACC; the rest are listed as “No location”.</p>; })()}
          <ChartBox title="Issues by location and status" subtitle="Top 12 locations" height={320}>
            <VBar data={locs.slice(0, 12).map((a) => ({ name: a.name, ...Object.fromEntries(COLS.map(([k, l]) => [l, a.by_status[k] ?? 0])), Other: other(a) }))} series={[...COLS.map(([, l]) => l), 'Other']} colors={[...COLS.map(([, , c]) => c), '#CBD5E1']} />
          </ChartBox>
          <div className="card overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Location</th>{COLS.map(([, l]) => <th key={l} className="p-2 text-right">{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{locs.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
        </> : <Empty title="This project's statistics do not include locations" hint="Upload a new ACC extract (Administration > ACC) to add them." />)}
        {p && view === 'assignee' && !p.assignees && <Empty title="This project's statistics do not include assignees" hint="Upload a new ACC extract (Administration > ACC) to add them." />}
        {p?.assignees && view === 'assignee' && <>
          <ChartBox title="Issues by assignee and status" subtitle="Top 12 assignees" height={320}>
            <VBar data={list.slice(0, 12).map((a) => ({ name: a.name, ...Object.fromEntries(COLS.map(([k, l]) => [l, a.by_status[k] ?? 0])), Other: other(a) }))} series={[...COLS.map(([, l]) => l), 'Other']} colors={[...COLS.map(([, , c]) => c), '#CBD5E1']} />
          </ChartBox>
          <div className="card overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Assignee</th><th className="p-2">Type</th>{COLS.map(([, l]) => <th key={l} className="p-2 text-right">{l}</th>)}<th className="p-2 text-right">Other</th><th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{list.map((a) => <tr key={a.key} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{a.name}</td><td className="p-2 text-slate-500">{KIND[a.kind]}</td>{COLS.map(([k]) => <td key={k} className="p-2 text-right">{a.by_status[k] ?? 0}</td>)}<td className="p-2 text-right text-slate-500">{other(a)}</td><td className="p-2 text-right font-semibold">{a.total}</td></tr>)}</tbody></table></div>
          <p className="text-xs text-slate-500"><BarChart3 className="mr-1 inline" size={12} />Most issues are assigned to ACC roles (groups), so those rows are shown as roles; people appear when an issue is assigned to a named person.</p>
        </>}
      </>}
    </div>);
}
