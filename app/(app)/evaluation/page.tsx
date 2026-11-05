'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Plus, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { BANDS, LEVELS, SECTIONS, STAGES, bandOf, cleanScore, levelOf, sectionScore, stageLabel, totals, type EvStatus, type Stage } from '@/lib/evaluation';

interface Row { id: string; employee_id: string; period: string; status: EvStatus; updated_at: string; totals: Partial<Record<Stage, { total: number; level: string; rated: number }>> }
interface StageData { scores: Record<string, { score: number | null; comment: string | null }>; overall_comment: string; submitted_at: string | null; submitted_by: string | null }
interface Info { location?: string; employment_date?: string; department?: string; section?: string; vacation_days?: number | null; sick_days?: number | null; late_hours?: number | null; education?: { degree: string; major: string; university: string; year: string }[] }
interface Detail { id: string; period: string; status: EvStatus; info: Info; employee: { id: string; name: string; job_title: string; photo_id: string | null; team_location: string | null }; has_manager: boolean; stages: Partial<Record<Stage, StageData>>; can: { edit: Stage | null; hr: boolean; reopen: boolean; delete: boolean } }
const TONE: Record<EvStatus, 'gray' | 'blue' | 'amber' | 'green'> = { self: 'gray', manager: 'blue', department: 'amber', completed: 'green' };
const f2 = (n: number) => n.toFixed(2);

export default function EvaluationPage() {
  const { me, data } = useApp(); const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null); const [canCreate, setCanCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState('all'); const [status, setStatus] = useState('all'); const [term, setTerm] = useState('');
  const load = useCallback(async () => { try { const r = await api<{ evaluations: Row[]; can_create: boolean }>('/api/evaluations'); setRows(r.evaluations); setCanCreate(r.can_create); } catch (e: any) { toast(e.message, 'err'); setRows((x) => x ?? []); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const emp = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const periods = useMemo(() => [...new Set((rows ?? []).map((r) => r.period))], [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => (period === 'all' || r.period === period) && (status === 'all' || r.status === status) && (!term || (emp.get(r.employee_id)?.name ?? '').toLowerCase().includes(term.toLowerCase()))).sort((a, b) => b.period.localeCompare(a.period) || (emp.get(a.employee_id)?.name ?? '').localeCompare(emp.get(b.employee_id)?.name ?? '')), [rows, period, status, term, emp]);

  if (openId) return <EvaluationForm id={openId} onBack={() => { setOpenId(null); load(); }} />;
  const cell = (r: Row, s: Stage) => { const t = r.totals[s]; if (!t) return <span className="text-slate-300">—</span>; return t.rated ? <span><b>{f2(t.total)}</b> <span className="text-xs text-slate-500">({t.level})</span></span> : <span className="text-slate-400">not started</span>; };
  return (
    <div className="space-y-4">
      <PageHeader title="Evaluation" subtitle="Annual performance evaluation. Each engineer evaluates himself first, then his direct manager, then the department manager."
        actions={canCreate ? <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add evaluation</button> : undefined} />
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <Field label="Period"><select className="input w-36" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All</option>{periods.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Status"><select className="input w-52" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{(['self', 'manager', 'department', 'completed'] as EvStatus[]).map((s) => <option key={s} value={s}>{s === 'completed' ? 'Completed' : `Waiting: ${stageLabel(s)}`}</option>)}</select></Field>
        <Field label="Engineer"><input className="input w-56" placeholder="Search name" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
        <span className="pb-2 text-sm text-slate-500">{shown.length} form(s)</span>
      </div>
      {!rows ? <Spinner /> : !shown.length ? <Empty title="No evaluations to show" hint={canCreate ? 'Use “Add evaluation” to create the form of an engineer, or of everybody in the org chart.' : 'Your evaluation form appears here once it has been created for you.'} />
        : <div className="card overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Engineer', 'Period', 'Status', 'Self', 'Direct manager', 'Department manager', 'Updated', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{shown.map((r) => <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setOpenId(r.id)}>
            <td className="td font-medium">{emp.get(r.employee_id)?.name ?? '—'}<span className="block text-xs font-normal text-slate-500">{emp.get(r.employee_id)?.job_title}</span></td><td className="td">{r.period}</td>
            <td className="td"><Badge tone={TONE[r.status]}>{r.status === 'completed' ? 'Completed' : `Waiting: ${stageLabel(r.status)}`}</Badge></td>
            <td className="td">{cell(r, 'self')}</td><td className="td">{cell(r, 'manager')}</td><td className="td">{cell(r, 'department')}</td>
            <td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(r.updated_at)}</td><td className="td"><button className="btn-secondary btn-sm" onClick={() => setOpenId(r.id)}>Open</button></td></tr>)}</tbody></table></div>}
      {adding && <AddForm employees={data.employees.filter((e) => e.active)} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      <p className="text-xs text-slate-500">{me.employee_id ? '' : 'Your login is not linked to an employee record, so you only see forms if you are the Administrator.'}</p>
    </div>
  );
}

function AddForm({ employees, onClose, onDone }: { employees: { id: string; name: string; job_title: string }[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [period, setPeriod] = useState(String(new Date().getFullYear())); const [all, setAll] = useState(false); const [emp, setEmp] = useState('');
  const save = async () => { try { const r: any = await api('/api/evaluations', { body: all ? { all: true, period } : { employee_id: emp, period } }); toast(all ? `${r.created} form(s) created` : 'Evaluation created'); onDone(); } catch (e: any) { toast(e.message, 'err'); } };
  return <Modal open onClose={onClose} title="Add evaluation" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!period.trim() || (!all && !emp)} onClick={save}>Create</button></>}>
    <div className="space-y-3">
      <Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026" /></Field>
      <div className="flex gap-4 text-sm"><label className="flex items-center gap-1"><input type="radio" checked={!all} onChange={() => setAll(false)} />One engineer</label><label className="flex items-center gap-1"><input type="radio" checked={all} onChange={() => setAll(true)} />Every active engineer in the org chart</label></div>
      {!all ? <Field label="Engineer"><select className="input" value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">— select —</option>{[...employees].sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name} — {e.job_title}</option>)}</select></Field>
        : <p className="text-sm text-slate-600">A form is created for every active person of the org chart that does not have one for this period yet. Existing forms are not touched.</p>}
    </div></Modal>;
}

function EvaluationForm({ id, onBack }: { id: string; onBack: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null); const [tab, setTab] = useState<Stage | 'summary'>('summary');
  const [scores, setScores] = useState<Record<string, { score: number | null; comment: string | null }>>({}); const [overall, setOverall] = useState(''); const [info, setInfo] = useState<Info>({});
  const [saving, setSaving] = useState(false); const [confirmSubmit, setConfirmSubmit] = useState(false); const [del, setDel] = useState(false); const [busy, setBusy] = useState(false);
  const pending = useRef<{ scores: Record<string, any>; overall?: string; info?: Info }>({ scores: {} }); const timer = useRef<any>(null); const stageRef = useRef<Stage | null>(null);

  const adopt = (x: Detail, first = false) => {
    setD(x); setInfo(x.info ?? {}); const st = x.can.edit ?? (STAGES.find((s) => s.key === x.status)?.key ?? null);
    const mine = x.can.edit ? x.stages[x.can.edit] : undefined; setScores(mine?.scores ?? {}); setOverall(mine?.overall_comment ?? ''); stageRef.current = x.can.edit;
    if (first) setTab(x.can.edit ?? (st && x.stages[st] ? st : 'summary'));
  };
  useEffect(() => { api<Detail>(`/api/evaluations/${id}`).then((x) => adopt(x, true)).catch((e) => { toast(e.message, 'err'); onBack(); }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = useCallback(async () => {
    clearTimeout(timer.current); const p = pending.current; const stage = stageRef.current;
    if (!Object.keys(p.scores).length && p.overall === undefined && !p.info) return;
    pending.current = { scores: {} }; setSaving(true);
    try { await api(`/api/evaluations/${id}`, { method: 'PUT', body: { stage: stage ?? 'self', ...(Object.keys(p.scores).length ? { scores: p.scores } : {}), ...(p.overall !== undefined ? { overall_comment: p.overall } : {}), ...(p.info ? { info: p.info } : {}) } }); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  }, [id, toast]);
  const queue = () => { clearTimeout(timer.current); timer.current = setTimeout(flush, 700); };
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  if (!d) return <Spinner />;
  const editable = d.can.edit; const editing = tab !== 'summary' && tab === editable;
  const setItem = (key: string, patch: Partial<{ score: number | null; comment: string | null }>) => {
    const cur = scores[key] ?? { score: null, comment: null }; const next = { ...cur, ...patch };
    setScores({ ...scores, [key]: next }); pending.current.scores[key] = next; queue();
  };
  const setI = (patch: Partial<Info>) => { const n = { ...info, ...patch }; setInfo(n); pending.current.info = n; queue(); };
  const setEdu = (i: number, k: 'degree' | 'major' | 'university' | 'year', v: string) => { const rows = [...(info.education ?? [])]; while (rows.length < 4) rows.push({ degree: '', major: '', university: '', year: '' }); rows[i] = { ...rows[i], [k]: v }; setI({ education: rows }); };
  const view = tab === 'summary' ? null : tab; const stageData = view ? d.stages[view] : undefined;
  const liveScores = (s: Stage): Record<string, number | null> => Object.fromEntries((Object.entries(s === editable ? scores : d.stages[s]?.scores ?? {}) as [string, { score: number | null }][]).map(([k, v]) => [k, v.score]));
  const visible = STAGES.filter((s) => d.stages[s.key]);
  const submit = async () => { setConfirmSubmit(false); setBusy(true); try { await flush(); const x = await api<Detail>(`/api/evaluations/${id}`, { method: 'PUT', body: { stage: editable!, submit: true } }); toast('Submitted'); adopt(x, true); setTab('summary'); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const reopen = async (to: Stage) => { setBusy(true); try { await api(`/api/evaluations/${id}/reopen`, { body: { to } }); toast('Sent back'); adopt(await api<Detail>(`/api/evaluations/${id}`), true); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const hrIn = (k: 'vacation_days' | 'sick_days' | 'late_hours', label: string) => <label className="flex items-center gap-2 text-sm"><span className="w-28 font-medium text-brand-700">{label}</span>{d.can.hr ? <input type="number" min={0} step="any" className="input w-24" value={info[k] ?? ''} onChange={(e) => setI({ [k]: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} /> : <span className="rounded border border-slate-200 bg-white px-2 py-1">{info[k] ?? '—'}</span>}</label>;
  const txt = (k: 'location' | 'employment_date' | 'department' | 'section', label: string, type = 'text') => <label className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm"><span className="font-medium text-brand-700">{label}</span>{editable ? <input type={type} className="input" value={info[k] ?? ''} onChange={(e) => setI({ [k]: e.target.value })} /> : <span className="rounded border border-slate-200 bg-white px-2 py-1">{info[k] || '—'}</span>}</label>;
  const edu = Array.from({ length: 4 }, (_, i) => info.education?.[i] ?? { degree: '', major: '', university: '', year: '' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><button className="btn-secondary btn-sm" onClick={async () => { await flush(); onBack(); }}><ArrowLeft size={14} />All evaluations</button>
        <h1 className="text-lg font-semibold text-brand-900">{d.employee.name} — {d.period}</h1><Badge tone={TONE[d.status]}>{d.status === 'completed' ? 'Completed' : `Waiting: ${stageLabel(d.status)}`}</Badge>
        {saving && <span className="text-xs text-slate-500">Saving…</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          {d.can.reopen && d.status !== 'self' && <select className="input w-52" value="" onChange={(e) => e.target.value && reopen(e.target.value as Stage)} aria-label="Send back to"><option value="">Send back to…</option>{STAGES.filter((s) => s.key !== 'department' || d.status === 'completed' || d.status === 'department').map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>}
          {d.can.delete && <button className="btn-ghost text-red-600" onClick={() => setDel(true)}><Trash2 size={16} />Delete</button>}
        </span></div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">{STAGES.map((s, i) => { const done = d.status === 'completed' || STAGES.findIndex((x) => x.key === d.status) > i; const cur = d.status === s.key; return <li key={s.key} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : cur ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-500'}`}>{done ? <CheckCircle2 size={14} /> : <span className="text-xs font-semibold">{i + 1}</span>}{s.label}</li>; })}</ol>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          <div className="card p-3 text-sm"><p className="mb-1 font-semibold underline">Level Legend:</p><div className="grid grid-cols-2 gap-1">{LEVELS.map((l) => <div key={l.k}><b className="text-brand-700">{l.k}</b> <span className="ml-1 rounded border border-slate-300 bg-white px-1.5 text-xs">{l.range}</span></div>)}</div></div>
          <div className="card space-y-1 p-3 text-sm">{BANDS.map((b) => <div key={b.k} className="flex items-center gap-2"><span className="h-5 w-8 shrink-0 rounded border border-slate-400" style={{ background: b.bg }} /><span><b>{b.k}</b> : {b.label} <span className="text-xs text-slate-500">({b.range})</span></span></div>)}</div>
        </div>
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start gap-4">
            {d.employee.photo_id ? <img src={`/api/files/${d.employee.photo_id}`} alt={`Photo of ${d.employee.name}`} className="h-36 w-28 rounded-lg border border-slate-300 bg-white object-cover" /> : <div className="flex h-36 w-28 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xs text-slate-400">No photo</div>}
            <div className="min-w-[16rem] flex-1 space-y-2"><p className="text-base font-semibold text-brand-900">{d.employee.name}<span className="ml-2 text-sm font-normal text-slate-500">{d.employee.job_title}</span></p>
              {txt('location', 'Location')}{txt('employment_date', 'Employment Date', 'date')}{txt('department', 'Department')}{txt('section', 'Section')}</div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-3">{hrIn('vacation_days', 'Vacation (days)')}{hrIn('sick_days', 'Sick (days)')}{hrIn('late_hours', 'Late (hrs)')}</div>
          <div className="overflow-x-auto border-t border-slate-200 pt-3"><table className="w-full text-left text-sm"><thead><tr>{['Degree', 'Major', 'University', 'Year'].map((h) => <th key={h} className="px-1 pb-1 text-center text-xs font-semibold text-brand-700">{h}</th>)}</tr></thead>
            <tbody>{edu.map((r, i) => <tr key={i}>{(['degree', 'major', 'university', 'year'] as const).map((k) => <td key={k} className="p-0.5">{editable ? <input className="input w-full" value={r[k]} onChange={(e) => setEdu(i, k, e.target.value)} /> : <span className="block min-h-[2rem] rounded border border-slate-200 bg-white px-2 py-1">{r[k]}</span>}</td>)}</tr>)}</tbody></table></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Evaluation parts">
        <button role="tab" aria-selected={tab === 'summary'} className={tab === 'summary' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('summary')}><ClipboardCheck size={14} />Summary</button>
        {visible.map((s) => <button key={s.key} role="tab" aria-selected={tab === s.key} className={tab === s.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab(s.key)}>{s.label}{d.stages[s.key]!.submitted_at ? ' ✓' : ''}</button>)}
        {editable && <button className="btn-primary btn-sm ml-auto" disabled={busy} onClick={() => setConfirmSubmit(true)}><Send size={14} />Submit {stageLabel(editable).toLowerCase()}</button>}
      </div>
      {editable && tab !== editable && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">It is your turn: open the <b>{stageLabel(editable)}</b> tab to fill your evaluation.</p>}

      {tab === 'summary' ? <Summary d={d} live={liveScores} /> : (
        <div className="space-y-4">
          {stageData?.submitted_at && <p className="text-xs text-slate-500">Submitted {fmtDate(stageData.submitted_at)}{stageData.submitted_by ? ` by ${stageData.submitted_by}` : ''}.</p>}
          {SECTIONS.map((sec) => { const sc = liveScores(view!); const got = sectionScore(sec, sc); const src = editing ? scores : stageData?.scores ?? {};
            return (
              <section key={sec.extra + sec.code} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 bg-brand-600 px-3 py-2 text-white"><span className="rounded bg-white/20 px-2 text-sm font-semibold">{sec.extra ? 'Extra ' : ''}{sec.code}</span><h2 className="font-semibold">{sec.title}</h2>
                  <span className="ml-auto text-sm">Total Weighted Score <b>{f2(got)}</b> / {f2(sec.weight)} = <b>{sec.weight ? Math.round((got / sec.weight) * 100) : 0}%</b></span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-600"><th className="w-12 px-2 py-1">Item</th><th className="px-2 py-1">Description</th><th className="px-2 py-1">Comments</th>{BANDS.map((b) => <th key={b.k} className="w-14 px-1 py-1 text-center">{b.k}</th>)}<th className="w-20 px-2 py-1 text-center">Score</th></tr></thead>
                  <tbody>{sec.items.map((it) => { const v = src[it.key]; const band = bandOf(v?.score);
                    return (<tr key={it.key} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{it.key.replace('E', '')}</td><td className="min-w-[16rem] px-2 py-1">{it.text}</td>
                      <td className="min-w-[12rem] px-2 py-1">{editing ? <input className="input w-full" value={v?.comment ?? ''} maxLength={1000} onChange={(e) => setItem(it.key, { comment: e.target.value })} aria-label={`Comment on ${it.text}`} /> : <span className="text-xs text-slate-600">{v?.comment}</span>}</td>
                      {BANDS.map((b) => <td key={b.k} className="px-0.5 py-1 text-center"><button type="button" disabled={!editing} title={`${b.label} (${b.range})`} onClick={() => setItem(it.key, { score: band === b.k ? v!.score : b.pick })} className={`w-full rounded border px-1 py-1 text-xs ${band === b.k ? 'border-slate-800 font-bold ring-2 ring-slate-700' : 'border-slate-300 opacity-60'} ${editing ? 'cursor-pointer hover:opacity-100' : 'cursor-default'}`} style={{ background: b.bg, color: b.text }}>{b.range}</button></td>)}
                      <td className="px-2 py-1 text-center">{editing ? <input type="number" min={0} max={10} step={0.5} className="input w-16 text-center" value={v?.score ?? ''} onChange={(e) => setItem(it.key, { score: e.target.value === '' ? null : cleanScore(e.target.value) })} aria-label={`Score of ${it.text}`} /> : <b>{v?.score ?? ''}</b>}</td>
                    </tr>); })}</tbody></table></div>
              </section>); })}
          <div className="card p-3"><Field label={`Overall comments — ${stageLabel(view!)}`}>{editing ? <textarea className="input min-h-[5rem] w-full" maxLength={4000} value={overall} onChange={(e) => { setOverall(e.target.value); pending.current.overall = e.target.value; queue(); }} /> : <p className="whitespace-pre-wrap text-sm">{stageData?.overall_comment || '—'}</p>}</Field></div>
          {(() => { const t = totals(liveScores(view!)); return <p className="text-sm">Total: <b>{f2(t.total)}</b> / 100 — Level <b>{t.level}</b> <span className="text-xs text-slate-500">(main sections {f2(t.core)} + extra activities {f2(t.extra)}, maximum 100)</span></p>; })()}
        </div>)}

      <Confirm open={confirmSubmit} title="Submit evaluation" message={editable ? `Submit the ${stageLabel(editable).toLowerCase()}? After submitting you cannot change it${editable === 'self' ? (d.has_manager ? '; your direct manager is next.' : '; the department manager is next.') : editable === 'manager' ? '; the department manager is next.' : '; the evaluation will be completed.'} Every item of the main sections must be scored.` : ''} confirmLabel="Submit" onClose={() => setConfirmSubmit(false)} onConfirm={submit} />
      <Confirm open={del} danger title="Delete evaluation" message="Delete this evaluation with all its scores? This cannot be undone." confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={async () => { setDel(false); try { await api(`/api/evaluations/${id}`, { method: 'DELETE' }); toast('Deleted'); onBack(); } catch (e: any) { toast(e.message, 'err'); } }} />
      <p className="text-xs text-slate-500">Each item is scored 0–10 (A 10-8 · F 8-6 · O 6-4 · S 4-2 · R 2→0 · N 0). Click a colour to set a typical score, then adjust the number if needed. Main sections count unscored items as 0; in the extra sections only the items you scored count.</p>
    </div>
  );
}

function Summary({ d, live }: { d: Detail; live: (s: Stage) => Record<string, number | null> }) {
  const vis = STAGES.filter((s) => d.stages[s.key]); const final = d.status === 'completed';
  const tot = Object.fromEntries(vis.map((s) => [s.key, totals(live(s.key))])) as Record<Stage, ReturnType<typeof totals>>;
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="th">Section</th><th className="th text-center">Weight</th>{vis.map((s) => <th key={s.key} className="th text-center">{s.label}</th>)}</tr></thead>
        <tbody>{SECTIONS.map((sec) => <tr key={sec.extra + sec.code} className="border-t border-slate-100"><td className="td">{sec.extra ? 'Extra: ' : `${sec.code}. `}{sec.title}</td><td className="td text-center">{f2(sec.weight)}</td>{vis.map((s) => <td key={s.key} className="td text-center">{f2(sectionScore(sec, live(s.key)))}</td>)}</tr>)}
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td">Total (maximum 100)</td><td className="td text-center">100</td>{vis.map((s) => <td key={s.key} className="td text-center">{f2(tot[s.key].total)}</td>)}</tr>
          <tr className="bg-slate-50 font-semibold"><td className="td">Level</td><td className="td" />{vis.map((s) => <td key={s.key} className="td text-center"><Badge tone={tot[s.key].rated ? 'blue' : 'gray'}>{tot[s.key].rated ? levelOf(tot[s.key].total) : '—'}</Badge></td>)}</tr></tbody></table></div>
      {!final && d.stages.self && vis.length < 3 && <p className="text-xs text-slate-500"><RotateCcw size={12} className="mr-1 inline" />The next parts become visible to you as the evaluation moves forward.</p>}
      <div className="grid gap-3 md:grid-cols-3">{vis.map((s) => <div key={s.key} className="card p-3"><p className="mb-1 text-sm font-semibold text-brand-800">{s.label}</p><p className="whitespace-pre-wrap text-sm text-slate-700">{d.stages[s.key]!.overall_comment || <span className="text-slate-400">No overall comment.</span>}</p></div>)}</div>
    </div>
  );
}
