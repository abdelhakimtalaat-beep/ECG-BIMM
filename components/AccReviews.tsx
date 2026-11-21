'use client';
import { useRef, useState } from 'react';
import { ChevronDown, ImageDown } from 'lucide-react';
import { ChartBox, ColBar, VBar } from '@/components/charts';
import { Empty, useToast } from '@/components/ui';

export interface ReviewDetail {
  total: number; in_progress: number; closed: number; void: number; overdue: number; avg_days: number | null; docs: number; approved_docs: number; rejected_docs: number; by_status: Record<string, number>;
  by_workflow: { name: string; total: number; in_progress: number; closed: number; void: number; approved_docs: number; rejected_docs: number }[];
  monthly: { month: string; started: number; finished: number }[]; pending_tasks: { name: string; unclaimed: number; claimed: number }[];
}
const STATUS: Record<string, [string, string]> = { open: ['Open', '#F97316'], restarting: ['Restarting', '#06B6D4'], in_review: ['In review', '#F97316'], closed: ['Closed', '#475569'], void: ['Void', '#CBD5E1'] };
const Card = ({ label, value, tone = 'text-brand-900', hint }: { label: string; value: string | number; tone?: string; hint?: string }) => <div className="card p-3"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`text-2xl font-semibold ${tone}`}>{value}</p>{hint && <p className="text-xs text-slate-400">{hint}</p>}</div>;
const Wide = ({ n, children, cap }: { n: number; children: React.ReactNode; cap: boolean }) => <div className={`h-full ${cap ? '' : 'overflow-x-auto'}`}><div className="h-full" style={{ minWidth: Math.max(560, n * 90) }}>{children}</div></div>;

/** Reviews dashboard of one project (from the ACC extract): status, workflows, documents, trend and open tasks. */
export function AccReviews({ d, title, file }: { d: ReviewDetail | null | undefined; title: string; file: string }) {
  const toast = useToast(); const ref = useRef<HTMLDivElement>(null); const [cap, setCap] = useState<'chart' | 'table' | 'both' | null>(null); const [menu, setMenu] = useState(false);
  if (!d) return <Empty title="This project's statistics do not include the reviews dashboard" hint="Press Import now, or upload a new ACC extract (Administration > ACC), to add it." />;
  if (!d.total) return <Empty title="This project has no reviews in ACC" hint="Reviews appear here once the project has review workflows in ACC." />;
  const exportJpg = async (what: 'chart' | 'table' | 'both') => {
    setMenu(false); setCap(what);
    try { await new Promise((r) => setTimeout(r, 450)); const node = ref.current; if (!node) return; const { toJpeg } = await import('html-to-image'); const url = await toJpeg(node, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' }); const a = document.createElement('a'); a.href = url; a.download = `ACC-${file}-reviews-${what}-${new Date().toISOString().slice(0, 10)}.jpg`; a.click(); }
    catch (e: any) { toast(`Could not create the image: ${e?.message ?? e}`, 'err'); } finally { setCap(null); }
  };
  const st = Object.entries(d.by_status).map(([k, v]) => ({ name: STATUS[k]?.[0] ?? k, value: v, color: STATUS[k]?.[1] ?? '#94A3B8' })).sort((a, b) => b.value - a.value);
  const wf = d.by_workflow; const months = d.monthly.map((m) => ({ name: m.month, Started: m.started, Finished: m.finished }));
  const approvedPct = d.approved_docs + d.rejected_docs ? Math.round((d.approved_docs / (d.approved_docs + d.rejected_docs)) * 100) : null;
  const hideChart = cap === 'table' ? 'hidden' : ''; const hideTable = cap === 'chart' ? 'hidden' : '';
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><div className="relative">
        <button className="btn-secondary" disabled={!!cap} onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}><ImageDown size={16} />Export JPG<ChevronDown size={14} /></button>
        {menu && <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">{([['chart', 'Charts only'], ['table', 'Tables only'], ['both', 'Charts and tables']] as const).map(([k, l]) => <button key={k} role="menuitem" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => exportJpg(k)}>{l}</button>)}</div>}
      </div></div>
      <div ref={ref} className={cap ? 'space-y-3 bg-white p-4' : 'space-y-4'} style={cap ? { width: 'max-content', minWidth: '100%' } : undefined}>
        <div className={cap ? 'block' : 'hidden'}><h2 className="text-lg font-semibold text-brand-900">ACC Reviews — {title}</h2></div>
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6 ${hideChart && cap === 'table' ? '' : ''}`}>
          <Card label="Reviews" value={d.total} /><Card label="In progress" value={d.in_progress} tone="text-orange-600" /><Card label="Closed" value={d.closed} tone="text-slate-700" />
          <Card label="Overdue" value={d.overdue} tone={d.overdue ? 'text-red-600' : 'text-slate-700'} hint="in progress, past due date" /><Card label="Average duration" value={d.avg_days == null ? '—' : `${d.avg_days} d`} hint="start to finish, closed reviews" />
          <Card label="Documents approved" value={approvedPct == null ? '—' : `${approvedPct}%`} tone="text-green-700" hint={`${d.approved_docs} approved · ${d.rejected_docs} rejected · ${d.docs} reviewed`} />
        </div>
        <div className={`grid gap-4 lg:grid-cols-2 ${hideChart}`}>
          <ChartBox title="Reviews by status" subtitle={`${d.total} reviews`} height={280}><ColBar data={st.map((s) => ({ name: s.name, value: s.value }))} colors={st.map((s) => s.color)} /></ChartBox>
          <ChartBox title="Reviews started and finished per month" subtitle="last 18 months" height={280}><VBarGroup data={months} /></ChartBox>
        </div>
        <div className={hideChart}><ChartBox title="Reviews by workflow" subtitle={`${wf.length} workflow(s)`} height={300}><Wide cap={!!cap} n={wf.length}><VBar data={wf.map((w) => ({ name: w.name, 'In progress': w.in_progress, Closed: w.closed, Void: w.void }))} series={['In progress', 'Closed', 'Void']} colors={['#F97316', '#475569', '#CBD5E1']} /></Wide></ChartBox></div>
        <div className={hideChart}><ChartBox title="Documents approved and rejected, by workflow" height={300}><Wide cap={!!cap} n={wf.length}><VBar data={wf.map((w) => ({ name: w.name, Approved: w.approved_docs, Rejected: w.rejected_docs }))} series={['Approved', 'Rejected']} colors={['#16A34A', '#DC2626']} /></Wide></ChartBox></div>
        <div className={`card overflow-x-auto ${hideTable}`}><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Workflow</th><th className="p-2 text-right">Reviews</th><th className="p-2 text-right">In progress</th><th className="p-2 text-right">Closed</th><th className="p-2 text-right">Void</th><th className="p-2 text-right">Docs approved</th><th className="p-2 text-right">Docs rejected</th></tr></thead>
          <tbody>{wf.map((w) => <tr key={w.name} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{w.name}</td><td className="p-2 text-right font-medium">{w.total}</td><td className="p-2 text-right">{w.in_progress}</td><td className="p-2 text-right">{w.closed}</td><td className="p-2 text-right">{w.void}</td><td className="p-2 text-right">{w.approved_docs}</td><td className="p-2 text-right">{w.rejected_docs}</td></tr>)}</tbody></table></div>
        {d.pending_tasks.length > 0 && <div className={`card overflow-x-auto ${hideTable}`}><h3 className="p-3 pb-0 text-sm font-semibold text-brand-900">Open review tasks (reviews still in progress)</h3><table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">Task</th><th className="p-2 text-right">Waiting to be claimed</th><th className="p-2 text-right">Being worked on</th></tr></thead>
          <tbody>{d.pending_tasks.map((t) => <tr key={t.name} className="border-b border-slate-100"><td className="p-2 font-medium text-brand-900">{t.name}</td><td className="p-2 text-right">{t.unclaimed}</td><td className="p-2 text-right">{t.claimed}</td></tr>)}</tbody></table></div>}
      </div>
    </div>);
}
/** Two side-by-side columns per month (started / finished). */
function VBarGroup({ data }: { data: { name: string; Started: number; Finished: number }[] }) {
  // a grouped (not stacked) bar chart; kept simple with plain divs so it needs no extra chart type
  const max = Math.max(1, ...data.flatMap((m) => [m.Started, m.Finished]));
  return (
    <div className="flex h-full flex-col"><div className="flex flex-1 items-end gap-1 overflow-x-auto pb-1">
      {data.map((m) => <div key={m.name} className="flex min-w-[34px] flex-1 flex-col items-center justify-end" title={`${m.name}: ${m.Started} started, ${m.Finished} finished`}>
        <div className="flex h-[200px] w-full items-end justify-center gap-0.5">
          <div className="relative w-3 rounded-t bg-orange-500" style={{ height: `${(m.Started / max) * 100}%` }}>{m.Started > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-600">{m.Started}</span>}</div>
          <div className="relative w-3 rounded-t bg-slate-600" style={{ height: `${(m.Finished / max) * 100}%` }}>{m.Finished > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-600">{m.Finished}</span>}</div>
        </div><span className="mt-1 text-[10px] text-slate-500">{m.name.slice(2)}</span></div>)}
    </div><div className="flex justify-center gap-4 text-xs text-slate-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />Started</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-600" />Finished</span></div></div>);
}
