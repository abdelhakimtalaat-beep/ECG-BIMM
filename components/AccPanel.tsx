'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import { ChartBox, ColBar, VBar } from './charts';
import { useApp } from './store';
import { useToast } from './ui';
import type { AccStats } from '@/lib/accStats';

interface Resp { linked: boolean; stats: AccStats | null; synced_at: string | null }
interface Status { projects: { acc_project_id: string; name: string; portal_project_id: string | null }[] }
const Kpi = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => <div className="rounded-lg border border-slate-200 bg-white p-3" title={hint}><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold text-brand-900">{value}</p></div>;

/** ACC statistics of one project (issues, reviews, clashes) read from the daily Data Connector extract. */
export function AccPanel({ projectId }: { projectId: string }) {
  const { me } = useApp(); const toast = useToast(); const [r, setR] = useState<Resp | null>(null); const [list, setList] = useState<Status['projects']>([]);
  const load = useCallback(async () => { try { setR(await api<Resp>(`/api/acc/stats?project_id=${projectId}`)); } catch { setR({ linked: false, stats: null, synced_at: null }); } }, [projectId]);
  useEffect(() => { setR(null); load(); }, [load]);
  useEffect(() => { if (me.role === 'admin') api<Status>('/api/acc/status').then((s) => setList(s.projects)).catch(() => {}); }, [me.role]);
  const link = async (acc: string) => { try { await api('/api/acc/map', { body: { project_id: projectId, acc_project_id: acc || null } }); toast(acc ? 'Linked to ACC' : 'Link removed'); load(); } catch (e: any) { toast(e.message, 'err'); } };
  if (!r) return null;
  const s = r.stats;
  if (!r.linked && me.role !== 'admin') return null;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-3" aria-label="ACC statistics">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-brand-900">ACC statistics</h3>
        {me.role === 'admin' && <label className="flex items-center gap-2 text-xs text-slate-600">ACC project<select className="input w-64" value={r.linked ? (list.find((x) => x.portal_project_id === projectId)?.acc_project_id ?? s?.project_id ?? '') : ''} onChange={(e) => link(e.target.value)}><option value="">— Not linked —</option>{list.map((x) => <option key={x.acc_project_id} value={x.acc_project_id}>{x.name || x.acc_project_id}</option>)}</select></label>}
      </div>
      {!s ? <p className="text-sm text-slate-500">{r.linked ? 'Linked. The statistics will appear after the next import from ACC.' : 'Link this project to its ACC project to show issues, reviews and clash tests here.'}</p> : <>
        <p className="text-xs text-slate-500">From the ACC extract of {r.synced_at ? fmtDate(r.synced_at) : '—'}. Updated daily; not live.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Open issues" value={s.issues.open} hint="Open, in dispute and draft" /><Kpi label="Closed issues" value={s.issues.closed} hint="Closed, completed and not approved" />
          <Kpi label="Avg. days to close" value={s.issues.avg_close_days ?? '—'} /><Kpi label="Overdue issues" value={s.issues.with_due_date ? s.issues.overdue : '—'} hint={`${s.issues.with_due_date} of ${s.issues.total} issues have a due date`} />
          <Kpi label="Reviews" value={s.reviews.total} hint={Object.entries(s.reviews.by_status).map(([k, v]) => `${k}: ${v}`).join(' · ')} /><Kpi label="Review tasks waiting" value={s.reviews.unclaimed_tasks} hint="Tasks of running reviews nobody has taken yet" />
          <Kpi label="Clash tests" value={s.clashes.tests} hint={Object.entries(s.clashes.by_status).map(([k, v]) => `${k}: ${v}`).join(' · ')} /><Kpi label="Photos / meetings" value={`${s.photos} / ${s.meetings}`} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartBox title="Issues opened and closed" subtitle="Last 12 months" height={240}><VBarSplit data={s.issues.monthly} /></ChartBox>
          <ChartBox title="Issues by type" height={240}><ColBar data={s.issues.by_type.map((x) => ({ name: x.name, value: x.count }))} /></ChartBox>
        </div>
      </>}
    </section>);
}
function VBarSplit({ data }: { data: { month: string; opened: number; closed: number }[] }) {
  return <VBar data={data.map((m) => ({ name: m.month.slice(2), Opened: m.opened, Closed: m.closed }))} series={['Opened', 'Closed']} colors={['#F59E0B', '#16A34A']} />;
}
