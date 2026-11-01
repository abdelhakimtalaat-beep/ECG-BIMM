'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, fmtDate, fmtNum } from '@/lib/client';
import { expectedManHours } from '@/lib/proposals';

interface Prop { id: string; project_name: string; proposal_number: string; client: string | null; proposal_manager: string | null; expected_man_hours: number | null; calc: any; created_at: string }

export default function ProposalsPage() {
  const { me } = useApp(); const toast = useToast(); const admin = me.role === 'admin';
  const [rows, setRows] = useState<Prop[] | null>(null); const [text, setText] = useState('');
  const [form, setForm] = useState<Partial<Prop> | null>(null); const [del, setDel] = useState<Prop | null>(null);
  const load = useCallback(async () => { try { setRows((await api<{ proposals: Prop[] }>('/api/proposals')).proposals); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => { const t = text.trim().toLowerCase(); return (rows ?? []).filter((r) => !t || [r.project_name, r.proposal_number, r.client, r.proposal_manager].some((v) => (v ?? '').toLowerCase().includes(t))); }, [rows, text]);
  const total = shown.reduce((a, r) => a + (r.expected_man_hours ?? 0), 0);
  return (
    <div className="space-y-4">
      <PageHeader title="Proposals" subtitle={admin ? 'Add proposals and estimate their man-hours from the workload criteria.' : 'Proposals prepared by the Department. Only the Administrator adds or changes them.'}
        actions={admin ? <button className="btn-primary" onClick={() => setForm({})}><Plus size={16} />Add proposal</button> : undefined} />
      <div className="card flex flex-wrap items-end gap-3 p-3"><Field label="Search"><div className="relative"><Search size={14} className="absolute left-2.5 top-3 text-slate-400" /><input className="input w-72 pl-8" placeholder="Project, number, client, manager…" value={text} onChange={(e) => setText(e.target.value)} /></div></Field>
        <p className="ml-auto text-sm text-slate-500">{shown.length} proposal{shown.length === 1 ? '' : 's'} · <b className="text-brand-900">{fmtNum(total)}</b> expected man-hours</p></div>
      {!rows ? <Spinner /> : !shown.length ? <Empty title="No proposals" hint={admin ? 'Use “Add proposal” to add the first one.' : undefined} /> : (
        <div className="card overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Proposal No.', 'Project name', 'Client', 'Proposal manager', 'Expected man-hours', 'Added', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{shown.map((r) => (
          <tr key={r.id} className="border-t border-slate-100"><td className="td whitespace-nowrap font-medium">{r.proposal_number}</td><td className="td min-w-[14rem] font-medium text-brand-900">{r.project_name}</td><td className="td">{r.client ?? '—'}</td><td className="td">{r.proposal_manager ?? '—'}</td>
            <td className="td whitespace-nowrap font-semibold text-violet-700 dark:text-violet-300">{r.expected_man_hours != null ? fmtNum(r.expected_man_hours) : '—'}</td><td className="td whitespace-nowrap text-xs text-slate-500">{fmtDate(r.created_at)}</td>
            <td className="td whitespace-nowrap">{admin && <><button className="btn-secondary btn-sm mr-1" aria-label={`Edit ${r.proposal_number}`} onClick={() => setForm(r)}><Pencil size={14} /></button><button className="btn-secondary btn-sm" aria-label={`Delete ${r.proposal_number}`} onClick={() => setDel(r)}><Trash2 size={14} /></button></>}</td></tr>))}</tbody></table></div>)}
      {form && <ProposalForm init={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      <Confirm open={!!del} title="Delete proposal" message={`Delete proposal ${del?.proposal_number}?`} confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={async () => { const r = del!; setDel(null); try { await api(`/api/proposals/${r.id}`, { method: 'DELETE' }); toast('Proposal deleted'); load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>
  );
}

function ProposalForm({ init, onClose, onSaved }: { init: Partial<Prop>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const isNew = !init.id;
  const [f, setF] = useState({ project_name: init.project_name ?? '', proposal_number: init.proposal_number ?? '', client: init.client ?? '', proposal_manager: init.proposal_manager ?? '', hours: init.expected_man_hours != null ? String(init.expected_man_hours) : '' });
  const [calc, setCalc] = useState<any>(init.calc ?? null); const [calcOpen, setCalcOpen] = useState(false);
  const save = async () => { try {
    const body = { project_name: f.project_name, proposal_number: f.proposal_number, client: f.client, proposal_manager: f.proposal_manager, expected_man_hours: f.hours === '' ? null : Number(f.hours), calc };
    await api(isNew ? '/api/proposals' : `/api/proposals/${init.id}`, { method: isNew ? 'POST' : 'PATCH', body }); toast(isNew ? 'Proposal added' : 'Proposal updated'); onSaved();
  } catch (e: any) { toast(e.message, 'err'); } };
  return <>
    <Modal open onClose={onClose} wide title={isNew ? 'Add proposal' : 'Edit proposal'} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!f.project_name.trim() || !f.proposal_number.trim() || (f.hours !== '' && isNaN(Number(f.hours)))} onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Project name"><input className="input" autoFocus value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} /></Field></div>
        <Field label="Proposal number"><input className="input" value={f.proposal_number} onChange={(e) => setF({ ...f, proposal_number: e.target.value })} /></Field>
        <Field label="Client"><input className="input" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
        <Field label="Proposal manager"><input className="input" value={f.proposal_manager} onChange={(e) => setF({ ...f, proposal_manager: e.target.value })} /></Field>
        <Field label="Expected man-hours" hint="Type it, or use the calculator."><div className="flex gap-2"><input inputMode="decimal" className="input" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value.replace(/[^\d.]/g, '') })} /><button type="button" className="btn-secondary shrink-0" onClick={() => setCalcOpen(true)}><Calculator size={16} />Calculate</button></div></Field>
      </div>
    </Modal>
    {calcOpen && <HoursCalculator init={calc} onClose={() => setCalcOpen(false)} onUse={(hours, inputs) => { setF({ ...f, hours: String(hours) }); setCalc(inputs); setCalcOpen(false); }} />}
  </>;
}

const NUM = (k: string, v: any, on: (x: string) => void, label: string) => <Field label={label}><input inputMode="decimal" className="input" value={v == null || v === '' ? '' : (() => { const [i, d] = String(v).split('.'); const n = i.replace(/[^\d]/g, ''); return (n ? Number(n).toLocaleString('en-US') : '') + (d !== undefined ? '.' + d : ''); })()} onChange={(e) => on(e.target.value.replace(/,/g, '').replace(/[^\d.]/g, ''))} /></Field>;

function HoursCalculator({ init, onClose, onUse }: { init: any; onClose: () => void; onUse: (hours: number, inputs: any) => void }) {
  const { data } = useApp(); const fac = data.settings.factors; const sf = data.settings.stage_factors;
  const [v, setV] = useState<any>({ built_up_area: '', plot_area: '', typicality: '', function_type: '', coordination_type: '', bim_standards: '', scope_items: [], scope_site: [], stages: [], ...(init ?? {}) });
  const r = expectedManHours({ ...v, built_up_area: Number(v.built_up_area) || null, plot_area: Number(v.plot_area) || null }, fac, sf, v.stages ?? []);
  const sel = (k: 'typicality' | 'function_type' | 'coordination_type' | 'bim_standards', label: string) => <Field label={label}><select className="input" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}><option value="">— not set —</option>{Object.keys(fac[k]).map((o) => <option key={o} value={o}>{o} ({fac[k][o]})</option>)}</select></Field>;
  const chk = (k: 'scope_items' | 'scope_site', label: string) => <div className="col-span-2"><p className="label">{label}</p><div className="flex flex-wrap gap-x-4 gap-y-2">{Object.keys(fac[k]).map((o) => { const cur: string[] = v[k] ?? []; return <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={cur.includes(o)} onChange={(e) => setV({ ...v, [k]: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o) })} />{o} <span className="text-xs text-slate-500">({fac[k][o]})</span></label>; })}</div></div>;
  return <Modal open onClose={onClose} wide title="Expected man-hours calculator" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={r.hours == null} onClick={() => onUse(r.hours!, v)}>Use {r.hours != null ? fmtNum(r.hours) : ''} man-hours</button></>}>
    <div className="grid grid-cols-2 gap-3">
      {NUM('built_up_area', v.built_up_area, (x) => setV({ ...v, built_up_area: x }), 'Built-up area')}{NUM('plot_area', v.plot_area, (x) => setV({ ...v, plot_area: x }), 'Plot Area')}
      {sel('typicality', 'Typicality')}{sel('function_type', 'Function')}{sel('coordination_type', 'Coordination')}{sel('bim_standards', 'BIM Standards')}
      {chk('scope_items', 'Buildings scope')}{chk('scope_site', 'Site work scope')}
      <div className="col-span-2"><p className="label">Stage (tick one or more)</p><div className="flex flex-wrap gap-x-4 gap-y-2">{Object.keys(sf).map((o) => { const cur: string[] = v.stages ?? []; return <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={cur.includes(o)} onChange={(e) => setV({ ...v, stages: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o) })} />{o} <span className="text-xs text-slate-500">({sf[o] ?? 0})</span></label>; })}</div></div>
      <div className="col-span-2 rounded-lg bg-brand-50 p-3 text-sm">
        <p className="text-slate-600">Workload = (Built-up area × Typicality × Function × Coordination × BIM Standards × Buildings scope) + (Plot Area × Function × Coordination × BIM Standards × Site work scope)</p>
        <p className="mt-1">Workload = <b className="text-brand-900">{r.workload == null ? 'not calculated yet' : fmtNum(r.workload)}</b></p>
        <p>× Stage factor (sum of the ticked stages) = <b className="text-brand-900">{r.stageFactor > 0 ? r.stageFactor : 'not set'}</b></p>
        <p className="mt-1 text-base">Expected man-hours = <b className="text-violet-700 dark:text-violet-300">{r.hours == null ? '—' : fmtNum(r.hours)}</b></p>
        {r.stageFactor <= 0 && <p className="mt-1 text-amber-700">Tick at least one stage whose factor is set (Administration → Workload factors → Stage factor).</p>}
        {r.stageFactor > 0 && r.workload == null && <p className="mt-1 text-amber-700">Function, Coordination and BIM Standards are required, plus either Built-up area + Typicality + a Buildings scope, or Plot Area + a Site work scope.</p>}
      </div>
    </div>
  </Modal>;
}
