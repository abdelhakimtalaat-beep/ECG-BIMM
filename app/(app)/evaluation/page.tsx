'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Pencil, Plus, RotateCcw, Send, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useApp } from '@/components/store';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { ChartBox, ColBar } from '@/components/charts';
import { BANDS, LEVELS, SECTIONS, STAGES, bandOf, cleanScore, itemText, secKey, secTitle, type Labels, levelOf, sectionScore, stageLabel, totals, type EvStatus, type Stage } from '@/lib/evaluation';

interface Row { late_hours?: number | null; id: string; employee_id: string; period: string; status: EvStatus; updated_at: string; totals: Partial<Record<Stage, { total: number; level: string; rated: number }>> }
interface StageData { scores: Record<string, { score: number | null; comment: string | null }>; overall_comment: string; submitted_at: string | null; submitted_by: string | null }
interface Info { location?: string; employment_date?: string; department?: string; section?: string; vacation_days?: number | null; sick_days?: number | null; late_hours?: number | null; education?: { degree: string; major: string; university: string; year: string }[] }
interface Detail { labels: Labels; id: string; period: string; status: EvStatus; info: Info; employee: { id: string; name: string; job_title: string; photo_id: string | null; team_location: string | null; education?: { degree: string; major: string; university: string; year: string }[] | null }; has_manager: boolean; skip_manager?: boolean; manager_name_set?: boolean; stages: Partial<Record<Stage, StageData>>; can: { edit: Stage[]; submit: Stage | null; hr: boolean; reopen: boolean; delete: boolean } }
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
      {!!rows && !!shown.length && <EvalCharts rows={shown} names={new Map(data.employees.map((e) => [e.id, e.name]))} />}
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
  const [scoresBy, setScoresBy] = useState<Partial<Record<Stage, Record<string, { score: number | null; comment: string | null }>>>>({}); const [overallBy, setOverallBy] = useState<Partial<Record<Stage, string>>>({}); const [info, setInfo] = useState<Info>({});
  const [labels, setLabels] = useState<Labels>({ items: {}, sections: {} }); const [wording, setWording] = useState(false); const labelTimer = useRef<any>(null);
  const [saving, setSaving] = useState(false); const [confirmSubmit, setConfirmSubmit] = useState(false); const [del, setDel] = useState(false); const [returnEmp, setReturnEmp] = useState(false); const [busy, setBusy] = useState(false);
  const pending = useRef<{ st: Partial<Record<Stage, { scores: Record<string, any>; overall?: string }>>; info?: Info }>({ st: {} }); const timer = useRef<any>(null);

  const adopt = (x: Detail, first = false) => {
    setD(x); setLabels(x.labels ?? { items: {}, sections: {} }); setInfo(x.info ?? {}); const st = x.can.submit ?? x.can.edit[0] ?? (STAGES.find((s) => s.key === x.status)?.key ?? null);
    setScoresBy(Object.fromEntries(STAGES.filter((q) => x.stages[q.key]).map((q) => [q.key, x.stages[q.key]!.scores]))); setOverallBy(Object.fromEntries(STAGES.filter((q) => x.stages[q.key]).map((q) => [q.key, x.stages[q.key]!.overall_comment])));
    if (first) setTab(x.can.submit ?? (st && x.stages[st] ? st : 'summary'));
  };
  useEffect(() => { api<Detail>(`/api/evaluations/${id}`).then((x) => adopt(x, true)).catch((e) => { toast(e.message, 'err'); onBack(); }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = useCallback(async () => {
    clearTimeout(timer.current); const p = pending.current; const stages = (Object.keys(p.st) as Stage[]).filter((k) => Object.keys(p.st[k]!.scores).length || p.st[k]!.overall !== undefined);
    if (!stages.length && !p.info) return;
    pending.current = { st: {} }; setSaving(true);
    try {
      let info = p.info;
      for (const stg of stages.length ? stages : (['self'] as Stage[])) { const x = p.st[stg]; await api(`/api/evaluations/${id}`, { method: 'PUT', body: { stage: stg, ...(x && Object.keys(x.scores).length ? { scores: x.scores } : {}), ...(x?.overall !== undefined ? { overall_comment: x.overall } : {}), ...(info ? { info } : {}) } }); info = undefined; }
    } catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  }, [id, toast]);
  const queue = () => { clearTimeout(timer.current); timer.current = setTimeout(flush, 700); };
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  if (!d) return <Spinner />;
  const submitStage = d.can.submit; const canInfo = d.can.edit.length > 0; const editing = tab !== 'summary' && d.can.edit.includes(tab);
  const setItem = (key: string, patch: Partial<{ score: number | null; comment: string | null }>) => {
    const st = tab as Stage; const cur = scoresBy[st]?.[key] ?? { score: null, comment: null }; const next = { ...cur, ...patch };
    setScoresBy({ ...scoresBy, [st]: { ...(scoresBy[st] ?? {}), [key]: next } }); ((pending.current.st[st] ??= { scores: {} }).scores)[key] = next; queue();
  };
  const setLabel = (kind: 'items' | 'sections', key: string, text: string) => {
    const n = { ...labels, [kind]: { ...labels[kind], [key]: text } }; setLabels(n); clearTimeout(labelTimer.current);
    labelTimer.current = setTimeout(async () => { try { setSaving(true); await api('/api/evaluations/config', { method: 'PUT', body: n }); } catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); } }, 800);
  };
  const setI = (patch: Partial<Info>) => { const n = { ...info, ...patch }; setInfo(n); pending.current.info = n; queue(); };
  const view = tab === 'summary' ? null : tab; const stageData = view ? d.stages[view] : undefined;
  const liveScores = (s: Stage): Record<string, number | null> => Object.fromEntries((Object.entries(scoresBy[s] ?? d.stages[s]?.scores ?? {}) as [string, { score: number | null }][]).map(([k, v]) => [k, v.score]));
  const visible = STAGES.filter((s) => d.stages[s.key]);
  const submit = async () => { setConfirmSubmit(false); setBusy(true); try { await flush(); const x = await api<Detail>(`/api/evaluations/${id}`, { method: 'PUT', body: { stage: submitStage!, submit: true } }); toast('Submitted'); adopt(x, true); setTab('summary'); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const reopen = async (to: Stage) => { setBusy(true); try { await api(`/api/evaluations/${id}/reopen`, { body: { to } }); toast('Sent back'); adopt(await api<Detail>(`/api/evaluations/${id}`), true); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const toggleMgr = async () => { setBusy(true); try { const x = await api<Detail>(`/api/evaluations/${id}/manager-step`, { body: { skip: !d.skip_manager } }); toast(d.skip_manager ? 'Direct manager step restored' : 'Direct manager step removed'); adopt(x, true); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const hrIn = (k: 'vacation_days' | 'sick_days' | 'late_hours', label: string) => <label className="flex items-center gap-2 text-sm"><span className="w-28 font-medium text-brand-700">{label}</span>{d.can.hr ? <input type="number" min={0} step="any" className="input w-24" value={info[k] ?? ''} onChange={(e) => setI({ [k]: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} /> : <span className="rounded border border-slate-200 bg-white px-2 py-1">{info[k] ?? '—'}</span>}</label>;
  const txt = (k: 'location' | 'employment_date' | 'department' | 'section', label: string, type = 'text') => <label className="grid grid-cols-[8rem_1fr] items-center gap-2 text-sm"><span className="font-medium text-brand-700">{label}</span>{canInfo ? <input type={type} className="input" value={info[k] ?? ''} onChange={(e) => setI({ [k]: e.target.value })} /> : <span className="rounded border border-slate-200 bg-white px-2 py-1">{info[k] || '—'}</span>}</label>;
  const edu = Array.from({ length: 4 }, (_, i) => d.employee.education?.[i] ?? { degree: '', major: '', university: '', year: '' }); // read from the employee's record in the Org Chart

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><button className="btn-secondary btn-sm" onClick={async () => { await flush(); onBack(); }}><ArrowLeft size={14} />All evaluations</button>
        <h1 className="text-lg font-semibold text-brand-900">{d.employee.name} — {d.period}</h1><Badge tone={TONE[d.status]}>{d.status === 'completed' ? 'Completed' : `Waiting: ${stageLabel(d.status)}`}</Badge>
        {saving && <span className="text-xs text-slate-500">Saving…</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          {d.can.reopen && d.status !== 'self' && d.stages.self?.submitted_at && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => setReturnEmp(true)} title="Send the form back to the employee to re-evaluate and submit again"><RotateCcw size={14} />Return to employee</button>}
          {d.can.reopen && d.status !== 'completed' && <button className={d.skip_manager ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} disabled={busy} onClick={toggleMgr} title={d.skip_manager ? 'Put the direct manager step back into this evaluation' : 'Remove the direct manager step: the form goes from the employee straight to the department manager'}>{d.skip_manager ? <UserPlus size={14} /> : <UserMinus size={14} />}{d.skip_manager ? 'Restore direct manager step' : 'Remove direct manager step'}</button>}
          {d.can.reopen && d.status !== 'self' && <select className="input w-52" value="" onChange={(e) => e.target.value && reopen(e.target.value as Stage)} aria-label="Send back to"><option value="">Send back to…</option>{STAGES.filter((s) => (s.key !== 'manager' || !d.skip_manager) && (s.key !== 'department' || d.status === 'completed' || d.status === 'department')).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>}
          {d.can.reopen && <button className={wording ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setWording(!wording)} title="Edit the description of the evaluation items (applies to every evaluation)"><Pencil size={14} />{wording ? 'Done editing items' : 'Edit items'}</button>}
          {d.can.delete && <button className="btn-ghost text-red-600" onClick={() => setDel(true)}><Trash2 size={16} />Delete</button>}
        </span></div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">{STAGES.filter((s) => !(d.skip_manager && s.key === 'manager')).map((s, n) => { const i = STAGES.findIndex((x) => x.key === s.key); const done = d.status === 'completed' || STAGES.findIndex((x) => x.key === d.status) > i; const cur = d.status === s.key; return <li key={s.key} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : cur ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-500'}`}>{done ? <CheckCircle2 size={14} /> : <span className="text-xs font-semibold">{n + 1}</span>}{s.label}</li>; })}</ol>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          <div className="card p-3 text-sm"><p className="mb-1 font-semibold underline">Level Legend:</p><div className="grid grid-cols-2 gap-1">{LEVELS.map((l) => <div key={l.k}><b className="text-brand-700">{l.k}</b> <span className="ml-1 rounded border border-slate-300 bg-white px-1.5 text-xs">{l.range}</span></div>)}</div></div>
          <div className="card space-y-1 p-3 text-sm">{BANDS.map((b) => <div key={b.k} className="flex items-start gap-2"><span className="mt-0.5 h-5 w-8 shrink-0 rounded border border-slate-400" style={{ background: b.bg }} /><span><b>{b.k}</b> : {b.label} <span className="text-xs text-slate-500">({b.range})</span><span dir="rtl" lang="ar" className="block text-slate-700">{b.ar}</span></span></div>)}</div>
        </div>
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-start gap-4">
            {d.employee.photo_id ? <img src={`/api/files/${d.employee.photo_id}`} alt={`Photo of ${d.employee.name}`} className="h-36 w-28 rounded-lg border border-slate-300 bg-white object-cover" /> : <div className="flex h-36 w-28 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xs text-slate-400">No photo</div>}
            <div className="min-w-[16rem] flex-1 space-y-2"><p className="text-base font-semibold text-brand-900">{d.employee.name}<span className="ml-2 text-sm font-normal text-slate-500">{d.employee.job_title}</span></p>
              {txt('location', 'Location')}{txt('employment_date', 'Employment Date', 'date')}{txt('department', 'Department')}{txt('section', 'Section')}</div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-3">{hrIn('vacation_days', 'Vacation (days)')}{hrIn('sick_days', 'Sick (days)')}{hrIn('late_hours', 'Late (hrs)')}</div>
          <div className="overflow-x-auto border-t border-slate-200 pt-3"><table className="w-full text-left text-sm"><thead><tr>{['Degree', 'Major', 'University', 'Year'].map((h) => <th key={h} className="px-1 pb-1 text-center text-xs font-semibold text-brand-700">{h}</th>)}</tr></thead>
            <tbody>{edu.map((r, i) => <tr key={i}>{(['degree', 'major', 'university', 'year'] as const).map((k) => <td key={k} className="p-0.5"><span className="block min-h-[2rem] rounded border border-slate-200 bg-white px-2 py-1">{r[k]}</span></td>)}</tr>)}</tbody></table></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Evaluation parts">
        <button role="tab" aria-selected={tab === 'summary'} className={tab === 'summary' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab('summary')}><ClipboardCheck size={14} />Summary</button>
        {visible.map((s) => <button key={s.key} role="tab" aria-selected={tab === s.key} className={tab === s.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab(s.key)}>{s.label}{d.stages[s.key]!.submitted_at ? ' ✓' : ''}</button>)}
        {submitStage && <button className="btn-primary btn-sm ml-auto" disabled={busy} onClick={() => setConfirmSubmit(true)}><Send size={14} />Submit {stageLabel(submitStage).toLowerCase()}</button>}
      </div>
      {submitStage && tab !== submitStage && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">It is your turn: open the <b>{stageLabel(submitStage)}</b> tab to fill the evaluation.</p>}
      {editing && d.can.reopen && !(submitStage === tab) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">You are editing this part as Administrator. Changes are saved automatically.</p>}

      {tab === 'summary' ? <Summary d={d} live={liveScores} labels={labels} /> : (
        <div className="space-y-4">
          {stageData?.submitted_at && <p className="text-xs text-slate-500">Submitted {fmtDate(stageData.submitted_at)}{stageData.submitted_by ? ` by ${stageData.submitted_by}` : ''}.</p>}
          {SECTIONS.map((sec) => { const sc = liveScores(view!); const got = sectionScore(sec, sc); const src = scoresBy[view!] ?? stageData?.scores ?? {};
            return (
              <section key={sec.extra + sec.code} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 bg-brand-600 px-3 py-2 text-white"><span className="rounded bg-white/20 px-2 text-sm font-semibold">{sec.extra ? 'Extra ' : ''}{sec.code}</span>{wording ? <input className="input w-72 text-slate-900" value={labels.sections[secKey(sec)] ?? sec.title} onChange={(e) => setLabel('sections', secKey(sec), e.target.value)} aria-label="Section title" /> : <h2 className="font-semibold">{secTitle(sec, labels)}</h2>}
                  <span className="ml-auto text-sm">Total Weighted Score <b>{f2(got)}</b> / {f2(sec.weight)} = <b>{sec.weight ? Math.round((got / sec.weight) * 100) : 0}%</b></span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-600"><th className="w-12 px-2 py-1">Item</th><th className="px-2 py-1">Description</th><th className="px-2 py-1">Comments</th>{BANDS.map((b) => <th key={b.k} className="w-14 px-1 py-1 text-center">{b.k}</th>)}<th className="w-20 px-2 py-1 text-center">Score</th></tr></thead>
                  <tbody>{sec.items.map((it) => { const v = src[it.key]; const band = bandOf(v?.score);
                    return (<tr key={it.key} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{it.key.replace('E', '')}</td><td className="min-w-[16rem] px-2 py-1">{wording ? <span className="flex gap-1"><input className="input w-full" maxLength={300} value={labels.items[it.key] ?? it.text} onChange={(e) => setLabel('items', it.key, e.target.value)} aria-label={`Description of item ${it.key}`} />{labels.items[it.key] && labels.items[it.key] !== it.text && <button type="button" className="btn-ghost btn-sm" title="Back to the original wording" onClick={() => setLabel('items', it.key, it.text)}><RotateCcw size={13} /></button>}</span> : itemText(it, labels)}</td>
                      <td className="min-w-[12rem] px-2 py-1">{editing ? <input className="input w-full" value={v?.comment ?? ''} maxLength={1000} onChange={(e) => setItem(it.key, { comment: e.target.value })} aria-label={`Comment on ${it.text}`} /> : <span className="text-xs text-slate-600">{v?.comment}</span>}</td>
                      {BANDS.map((b) => <td key={b.k} className="px-0.5 py-1 text-center"><button type="button" disabled={!editing} title={`${b.label} — ${b.ar} (${b.range})`} onClick={() => setItem(it.key, { score: band === b.k ? v!.score : b.pick })} className={`w-full rounded border px-1 py-1 text-xs ${band === b.k ? 'border-slate-800 font-bold ring-2 ring-slate-700' : 'border-slate-300 opacity-60'} ${editing ? 'cursor-pointer hover:opacity-100' : 'cursor-default'}`} style={{ background: b.bg, color: b.text }}>{b.range}</button></td>)}
                      <td className="px-2 py-1 text-center">{editing ? <input type="number" min={0} max={10} step={0.5} className="input w-16 text-center" value={v?.score ?? ''} onChange={(e) => setItem(it.key, { score: e.target.value === '' ? null : cleanScore(e.target.value) })} aria-label={`Score of ${it.text}`} /> : <b>{v?.score ?? ''}</b>}</td>
                    </tr>); })}</tbody></table></div>
              </section>); })}
          <div className="card p-3"><Field label={`Overall comments — ${stageLabel(view!)}`}>{editing ? <textarea className="input min-h-[5rem] w-full" maxLength={4000} value={overallBy[view!] ?? ''} onChange={(e) => { const v = e.target.value; setOverallBy({ ...overallBy, [view!]: v }); (pending.current.st[view!] ??= { scores: {} }).overall = v; queue(); }} /> : <p className="whitespace-pre-wrap text-sm">{stageData?.overall_comment || '—'}</p>}</Field></div>
          {(() => { const t = totals(liveScores(view!)); return <p className="text-sm">Total: <b>{f2(t.total)}</b> / 100 — Level <b>{t.level}</b> <span className="text-xs text-slate-500">(main sections {f2(t.core)} + extra activities {f2(t.extra)}, maximum 100)</span></p>; })()}
        </div>)}

      <Confirm open={confirmSubmit} title="Submit evaluation" message={submitStage ? `Submit the ${stageLabel(submitStage).toLowerCase()}? After submitting you cannot change it${submitStage === 'self' ? (d.has_manager ? '; your direct manager is next.' : '; the department manager is next.') : submitStage === 'manager' ? '; the department manager is next.' : '; the evaluation will be completed.'} Every item of the main sections must be scored.` : ''} confirmLabel="Submit" onClose={() => setConfirmSubmit(false)} onConfirm={submit} />
      <Confirm open={returnEmp} title="Return to employee" message={`Send this evaluation back to ${d.employee.name}? He can change his self-evaluation and submit it again; the direct manager and the department manager then repeat their parts (their scores are kept as a starting point).`} confirmLabel="Return" onClose={() => setReturnEmp(false)} onConfirm={() => { setReturnEmp(false); reopen('self'); }} />
      <Confirm open={del} danger title="Delete evaluation" message="Delete this evaluation with all its scores? This cannot be undone." confirmLabel="Delete" onClose={() => setDel(false)} onConfirm={async () => { setDel(false); try { await api(`/api/evaluations/${id}`, { method: 'DELETE' }); toast('Deleted'); onBack(); } catch (e: any) { toast(e.message, 'err'); } }} />
      <p className="text-xs text-slate-500">Each item is scored 0–10 (A 8-10 · F 6-7.5 · O 4-5.5 · S 2-3.5 · R 0.5-1.5 · N 0). Click a colour to set a typical score, then adjust the number if needed. Main sections count unscored items as 0; in the extra sections only the items you scored count.</p>
    </div>
  );
}

function Summary({ d, live, labels }: { d: Detail; live: (s: Stage) => Record<string, number | null>; labels: Labels }) {
  const vis = STAGES.filter((s) => d.stages[s.key]); const final = d.status === 'completed';
  const tot = Object.fromEntries(vis.map((s) => [s.key, totals(live(s.key))])) as Record<Stage, ReturnType<typeof totals>>;
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="th">Section</th><th className="th text-center">Weight</th>{vis.map((s) => <th key={s.key} className="th text-center">{s.label}</th>)}</tr></thead>
        <tbody>{SECTIONS.map((sec) => <tr key={sec.extra + sec.code} className="border-t border-slate-100"><td className="td">{sec.extra ? 'Extra: ' : `${sec.code}. `}{secTitle(sec, labels)}</td><td className="td text-center">{f2(sec.weight)}</td>{vis.map((s) => <td key={s.key} className="td text-center">{f2(sectionScore(sec, live(s.key)))}</td>)}</tr>)}
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td">Total (maximum 100)</td><td className="td text-center">100</td>{vis.map((s) => <td key={s.key} className="td text-center">{f2(tot[s.key].total)}</td>)}</tr>
          <tr className="bg-slate-50 font-semibold"><td className="td">Level</td><td className="td" />{vis.map((s) => <td key={s.key} className="td text-center"><Badge tone={tot[s.key].rated ? 'blue' : 'gray'}>{tot[s.key].rated ? levelOf(tot[s.key].total) : '—'}</Badge></td>)}</tr></tbody></table></div>
      {!final && d.stages.self && vis.length < 3 && <p className="text-xs text-slate-500"><RotateCcw size={12} className="mr-1 inline" />The next parts become visible to you as the evaluation moves forward.</p>}
      <div className="grid gap-3 md:grid-cols-3">{vis.map((s) => <div key={s.key} className="card p-3"><p className="mb-1 text-sm font-semibold text-brand-800">{s.label}</p><p className="whitespace-pre-wrap text-sm text-slate-700">{d.stages[s.key]!.overall_comment || <span className="text-slate-400">No overall comment.</span>}</p></div>)}</div>
    </div>
  );
}

/** The latest stage that has been scored is the score of the form: department manager, else direct manager, else self. */
const finalOf = (r: Row): { total: number; level: string; stage: Stage } | null => { for (const st of ['department', 'manager', 'self'] as Stage[]) { const t = r.totals[st]; if (t && t.rated) return { total: t.total, level: t.level, stage: st }; } return null; };
const LEVEL_COLORS: Record<string, string> = { A: '#2FA24F', 'B+': '#1F6FC9', B: '#4F8FDB', 'C+': '#F59E0B', C: '#DC2626' };

function EvalCharts({ rows, names }: { rows: Row[]; names: Map<string, string> }) {
  const periods = new Set(rows.map((r) => r.period)); const label = (r: Row) => `${names.get(r.employee_id) ?? '—'}${periods.size > 1 ? ` (${r.period})` : ''}`;
  const score = rows.map((r) => ({ r, f: finalOf(r) })).filter((x) => x.f).sort((a, b) => b.f!.total - a.f!.total);
  const late = rows.filter((r) => r.late_hours != null).sort((a, b) => (b.late_hours ?? 0) - (a.late_hours ?? 0));
  const missing = rows.length - score.length;
  return (
    <section className="space-y-3" aria-label="Evaluation charts">
      <h2 className="text-lg font-semibold text-brand-900">Charts</h2>
      <div className="grid gap-4">
        <ChartBox title="Evaluation score" subtitle={`Out of 100, latest scored stage of each form${missing ? ` · ${missing} form(s) not scored yet` : ''}`} height={320}>
          {score.length ? <ColBar max={100} data={score.map(({ r, f }) => ({ name: label(r), value: Math.round(f!.total * 100) / 100, tip: `Level ${f!.level} · ${stageLabel(f!.stage)}` }))} colors={score.map(({ f }) => LEVEL_COLORS[f!.level] ?? '#1F6FC9')} /> : <p className="py-10 text-center text-sm text-slate-500">No scores yet.</p>}
        </ChartBox>
        <ChartBox title="Late hours" subtitle="As entered by the Administrator on each form" height={320}>
          {late.length ? <ColBar color="#D97706" unit=" h" data={late.map((r) => ({ name: label(r), value: r.late_hours ?? 0 }))} /> : <p className="py-10 text-center text-sm text-slate-500">No late hours entered yet.</p>}
        </ChartBox>
      </div>
      <p className="text-xs text-slate-500">Score colours: <span className="font-medium" style={{ color: LEVEL_COLORS.A }}>A</span> · <span className="font-medium" style={{ color: LEVEL_COLORS['B+'] }}>B+</span> · <span className="font-medium" style={{ color: LEVEL_COLORS.B }}>B</span> · <span className="font-medium" style={{ color: LEVEL_COLORS['C+'] }}>C+</span> · <span className="font-medium" style={{ color: LEVEL_COLORS.C }}>C</span>. The charts follow the Period / Status / Engineer filters above.</p>
    </section>
  );
}
