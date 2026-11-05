import { ApiError } from './auth';
import { one, q } from './db';
import { cleanLabels, STAGES, canEditHr, canEditStage, canSubmitStage, totals, visibleStages, type Actors, type EvStatus, type Stage, type Who } from './evaluation';
import type { Me } from './types';

export interface EvRow { id: string; employee_id: string; period: string; status: EvStatus; info: any; created_at: string; updated_at: string }
export const deptManagerIds = async (): Promise<string[]> => (await q<{ id: string }>(`select id from employees where job_category='department_manager' and active`)).map((r) => r.id);
export async function actorsFor(employeeId: string, depts?: string[]): Promise<Actors> {
  const m = await one<{ manager_id: string }>('select manager_id from reporting_relationships where employee_id=$1 and valid_to is null limit 1', [employeeId]);
  return { employeeId, managerId: m?.manager_id ?? null, deptIds: depts ?? (await deptManagerIds()) };
}
export async function loadLabels() { const r = await one<{ value: any }>(`select value from app_settings where key='evaluation_labels'`); return cleanLabels(r?.value); }
export const whoOf = (me: Me): Who => ({ role: me.role, employee_id: me.employee_id });
export async function loadEv(id: string): Promise<EvRow> {
  const ev = await one<EvRow>('select id,employee_id,period,status,info,created_at,updated_at from evaluations where id=$1', [id]);
  if (!ev) throw new ApiError(404, 'Evaluation not found');
  return ev;
}
const mapScores = (rows: any[]) => { const o: Record<string, { score: number | null; comment: string | null }> = {}; for (const r of rows) o[r.item_key] = { score: r.score === null ? null : Number(r.score), comment: r.comment }; return o; };

/** Everything the person may see of one form — stages he is not allowed to see are left out entirely. */
export async function detail(me: Me, ev: EvRow, a: Actors) {
  const who = whoOf(me); const vis = visibleStages(who, a, ev.status);
  if (!vis) throw new ApiError(403, 'You do not have access to this evaluation');
  const [emp, sc, st] = await Promise.all([
    one<any>('select id,name,job_title,photo_id,team_location,education from employees where id=$1', [ev.employee_id]),
    q<any>('select stage,item_key,score,comment from evaluation_scores where evaluation_id=$1', [ev.id]),
    q<any>('select stage,overall_comment,submitted_at,submitted_by from evaluation_stages where evaluation_id=$1', [ev.id]),
  ]);
  const stages: Record<string, any> = {};
  for (const s of vis) {
    const scores = mapScores(sc.filter((r) => r.stage === s)); const meta = st.find((r) => r.stage === s);
    stages[s] = { scores, overall_comment: meta?.overall_comment ?? '', submitted_at: meta?.submitted_at ?? null, submitted_by: meta?.submitted_by ?? null, totals: totals(Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.score]))) };
  }
  const editing = STAGES.filter((s) => vis.includes(s.key) && canEditStage(who, a, ev.status, s.key)).map((s) => s.key);
  const labels = await loadLabels();
  return { labels, id: ev.id, period: ev.period, status: ev.status, info: ev.info ?? {}, employee: emp, has_manager: !!a.managerId, stages, can: { edit: editing as Stage[], submit: canSubmitStage(who, a, ev.status), hr: canEditHr(who, a, ev.status), reopen: me.role === 'admin', delete: me.role === 'admin' } };
}
