'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { AlertTriangle, BellRing, ChevronLeft, ChevronRight, Download, FileDown, FileSpreadsheet, Mail, Plus } from 'lucide-react';
import { useApp } from '@/components/store';
import { FilterBar } from '@/components/FilterBar';
import { ChartBox, Datum, HBar, VBar } from '@/components/charts';
import { Badge, Confirm, Empty, Field, Modal, PageHeader, useToast } from '@/components/ui';
import { api, download, fmtDate, fmtDateTime } from '@/lib/client';
import { DEFAULT_MEETING_LINK, DEFAULT_REEL_CC, DEFAULT_REEL_TO, reelMailContent, toAddresses } from '@/lib/reelEml';
import { drawReelImage, REEL_IMG_H, REEL_IMG_W } from '@/lib/reelImage';
import { canEditReels, canEditReel } from '@/lib/can';
import { reelConflicts, reelStats, upcomingReels, incompleteReels, weekdayOf } from '@/lib/metrics';
import { REEL_STATUSES, SOFTWARES, type Reel, type ReelStatus } from '@/lib/types';

const TONE: Record<ReelStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = { 'Not recorded': 'gray', Planned: 'blue', Completed: 'green', Postponed: 'amber', Cancelled: 'red' };
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export default function ReelsPage() {
  const { me, data, reels, today, refresh } = useApp(); const toast = useToast();
  const admin = canEditReels(me); // may add Planned reels
  const isAdm = me.role === 'admin'; // only the Administrator changes status
  const ed = (r: Reel) => canEditReel(me, r.status); // BIM Manager/Coordinator: Planned reels only
  const canDelete = me.role === 'admin';
  const [view, setView] = useState<'table' | 'calendar' | 'week' | 'month' | 'upcoming'>('table');
  const [cursor, setCursor] = useState(() => { const first = data.reels.find((r) => r.session_date >= today)?.session_date ?? data.reels[0]?.session_date ?? today; return first.slice(0, 7) + '-01'; });
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return iso(d); });
  const [edit, setEdit] = useState<Partial<Reel> | null>(null); const [del, setDel] = useState<Reel | null>(null); const [img, setImg] = useState<Reel | null>(null);
  const conflicts = useMemo(() => reelConflicts(data.reels), [data.reels]);
  const stats = useMemo(() => reelStats(reels), [reels]);
  const up = useMemo(() => upcomingReels(reels, today), [reels, today]);
  const soon = upcomingReels(data.reels, today, data.settings.alerts.reel_reminder_days);
  const late = incompleteReels(reels, today);
  const byDate = useMemo(() => { const m = new Map<string, Reel[]>(); for (const r of reels) (m.get(r.session_date) ?? m.set(r.session_date, []).get(r.session_date)!).push(r); return m; }, [reels]);

  const monthStart = new Date(cursor + 'T00:00:00Z'); const mIdx = monthStart.getUTCMonth(), yr = monthStart.getUTCFullYear();
  const gridStart = addDays(cursor, -monthStart.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthKey = cursor.slice(0, 7);
  const label = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shiftMonth = (n: number) => { const d = new Date(Date.UTC(yr, mIdx + n, 1)); setCursor(iso(d)); };

  const chip = (r: Reel) => (
    <button key={r.id} onClick={() => setEdit(r)} title={`${r.presenter_name}${r.topic ? ' — ' + r.topic : ''} (${r.status})${conflicts.get(r.id) ? '\n⚠ ' + conflicts.get(r.id)!.join('\n⚠ ') : ''}`}
      className={`mb-1 block w-full truncate rounded px-1.5 py-1 text-left text-xs ${r.status === 'Completed' ? 'bg-emerald-100 text-emerald-900' : r.status === 'Cancelled' ? 'bg-red-100 text-red-800 line-through' : r.status === 'Postponed' ? 'bg-amber-100 text-amber-900' : 'bg-brand-100 text-brand-900'}`}>
      {conflicts.has(r.id) && '⚠ '}{r.presenter_name}{r.topic ? ` · ${r.topic}` : ''}</button>);

  const exportAs = async (format: 'xlsx' | 'csv' | 'ics') => { try { await download('/api/export/reels', { ids: reels.map((r) => r.id), format }, `ecg-bim-reels.${format}`); } catch (e: any) { toast(e.message, 'err'); } };
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(15); doc.setTextColor(11, 37, 69); doc.text('Weekly BIM Reels Plan', 36, 40); doc.setFontSize(8); doc.setTextColor(100); doc.text(`Generated ${fmtDateTime(new Date())}`, 36, 54);
    autoTable(doc, { startY: 66, head: [['Day', 'Date', 'Topic', 'Software', 'Speaker', 'Status']], body: reels.map((r) => [r.weekday, fmtDate(r.session_date), r.topic ?? '', r.software ?? '', r.presenter_name, r.status]), styles: { fontSize: 8 }, headStyles: { fillColor: [15, 85, 168] }, alternateRowStyles: { fillColor: [238, 245, 253] } });
    doc.save('ecg-bim-reels.pdf');
  };
  const quick = async (r: Reel, patch: Partial<Reel>) => { try { await api(`/api/reels/${r.id}`, { method: 'PATCH', body: patch }); await refresh(); } catch (e: any) { toast(e.message, 'err'); } };

  const presenterData: Datum[] = Object.entries(stats.byPresenter).map(([k, v]) => ({ key: k, name: k, value: v }));
  const topicData = Object.entries(stats.byTopic).map(([k, v]) => ({ key: k, name: k, value: v }));
  const monthData = Object.entries(reels.reduce((m: Record<string, Record<string, number>>, r) => { const k = r.session_date.slice(0, 7); (m[k] ??= {})[r.status] = (m[k][r.status] || 0) + 1; return m; }, {})).sort().map(([k, v]) => ({ name: k, ...v }));

  const renderTable = (rows: Reel[]) => !rows.length ? <Empty title="No sessions" hint="Adjust the filters or add a session." /> : (
    <div className="card overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Day', 'Date', 'Topic', 'Software', 'Speaker', 'Status', 'Link', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.id} className={`border-t border-slate-100 ${i % 2 ? 'bg-amber-50/70' : 'bg-brand-50/70'}`}>
          <td className="td">{r.weekday}</td><td className="td whitespace-nowrap">{fmtDate(r.session_date)}</td>
          <td className="td min-w-[14rem]">{ed(r) ? <input className="input" defaultValue={r.topic ?? ''} placeholder="Add topic…" onBlur={(e) => e.target.value !== (r.topic ?? '') && quick(r, { topic: e.target.value || null })} aria-label={`Topic for ${r.presenter_name}`} /> : (r.topic ?? <span className="text-slate-400">—</span>)}</td>
          <td className="td">{ed(r) ? <select className="input w-32" value={r.software ?? ''} onChange={(e) => quick(r, { software: e.target.value || null })} aria-label={`Software for ${r.presenter_name}`}><option value="">—</option>{SOFTWARES.map((s) => <option key={s}>{s}</option>)}</select> : (r.software ?? <span className="text-slate-400">—</span>)}</td>
          <td className="td font-medium">{r.presenter_name}{conflicts.has(r.id) && <span className="ml-1 cursor-help text-amber-600" title={conflicts.get(r.id)!.join('\n')}><AlertTriangle size={14} className="inline" /></span>}{!r.employee_id && <span title="Speaker is not in the org chart"> <Badge tone="amber">not in org chart</Badge></span>}</td>
          <td className="td">{isAdm ? <select className="input w-36" value={r.status} onChange={(e) => quick(r, { status: e.target.value as ReelStatus })} aria-label={`Status for ${r.presenter_name}`}>{REEL_STATUSES.map((s) => <option key={s}>{s}</option>)}</select> : <Badge tone={TONE[r.status]}>{r.status}</Badge>}</td>
          <td className="td text-xs">{r.link ? <a className="text-brand-600 underline" href={r.link} target="_blank" rel="noopener noreferrer">Open link</a> : <span className="text-slate-400">—</span>}</td>
          <td className="td whitespace-nowrap"><button className="btn-secondary btn-sm mr-1" title="Email the BIM Reel announcement" onClick={() => setImg(r)}><Mail size={14} className="inline" /> Email</button>{ed(r) ? <><button className="btn-secondary btn-sm" onClick={() => setEdit(r)}>Edit</button> {canDelete && <button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(r)}>Delete</button>}</> : <button className="btn-secondary btn-sm" onClick={() => setEdit(r)}>View</button>}</td></tr>))}</tbody></table></div>);

  return (
    <>
      <PageHeader title="Weekly BIM Reels Plan" subtitle="Editable training and knowledge-sharing schedule (started from the supplied plan)."
        actions={<>{admin && <button className="btn-primary" onClick={() => setEdit({ status: 'Planned', session_date: addDays(data.reels.at(-1)?.session_date ?? today, 3) })}><Plus size={16} />Add session</button>}
          <button className="btn-secondary" onClick={() => exportAs('xlsx')}><FileSpreadsheet size={16} />Excel</button><button className="btn-secondary" onClick={exportPdf}><FileDown size={16} />PDF</button><button className="btn-secondary" onClick={() => exportAs('ics')}><Download size={16} />Calendar (.ics)</button></>} />
      <FilterBar show={['q', 'member', 'date']} />
      {(soon.length > 0 || late.length > 0) && <div className="mb-4 space-y-2">
        {soon.length > 0 && <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm"><BellRing size={18} className="mt-0.5 text-brand-600" /><span><b>Reminder:</b> {soon.map((r) => `${fmtDate(r.session_date)} ${r.presenter_name}`).join(' · ')} (next {data.settings.alerts.reel_reminder_days} days)</span></div>}
        {late.length > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><AlertTriangle size={18} className="mt-0.5 text-amber-600" /><span><b>{late.length} past session(s) have no recorded outcome.</b> The source plan has no status column, so none is assumed Completed. Mark each one Completed, Postponed or Cancelled to keep the analytics accurate.</span></div>}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[['Scheduled', stats.total], ['Completed', stats.completed], ['Upcoming', up.length], ['Postponed / cancelled', stats.postponed + stats.cancelled], ['No outcome recorded', stats.notRecorded], ['Completion rate', stats.completionRate == null ? '—' : Math.round(stats.completionRate * 100) + '%']].map(([k, v]) => <div key={String(k)} className="card p-3"><p className="text-xs uppercase tracking-wide text-slate-500">{k}</p><p className="text-xl font-semibold text-brand-900">{v}</p></div>)}</div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">{([['table', 'Table'], ['calendar', 'Calendar'], ['week', 'Weekly'], ['month', 'Monthly'], ['upcoming', 'Upcoming']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${view === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>)}</div>

      {(view === 'calendar' || view === 'month') && <div className="mb-3 flex items-center gap-2"><button className="btn-secondary btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button><b className="w-40 text-center text-sm">{label}</b><button className="btn-secondary btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={14} /></button></div>}

      {view === 'calendar' && <div className="card overflow-hidden"><div className="grid grid-cols-7 bg-brand-50 text-center text-xs font-semibold uppercase text-brand-800">{WD.map((d) => <div key={d} className="py-2">{d.slice(0, 3)}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((d) => { const inM = d.startsWith(monthKey); return <div key={d} className={`min-h-[5.5rem] border-t border-l border-slate-100 p-1 ${inM ? 'bg-white' : 'bg-slate-50/70 text-slate-400'} ${d === today ? 'ring-2 ring-inset ring-brand-400' : ''}`}><div className="mb-1 text-right text-xs">{Number(d.slice(8))}</div>{(byDate.get(d) ?? []).map(chip)}</div>; })}</div></div>}

      {view === 'week' && <><div className="mb-3 flex items-center gap-2"><button className="btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft size={14} /></button><b className="text-sm">Week of {fmtDate(weekStart)}</b><button className="btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight size={14} /></button></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">{Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => <div key={d} className={`card min-h-[8rem] p-2 ${d === today ? 'ring-2 ring-brand-400' : ''}`}><p className="text-xs font-semibold text-brand-800">{weekdayOf(d).slice(0, 3)} {Number(d.slice(8))}</p><div className="mt-2">{(byDate.get(d) ?? []).map(chip)}{!(byDate.get(d) ?? []).length && <p className="text-xs text-slate-300">—</p>}</div></div>)}</div></>}

      {view === 'month' && renderTable(reels.filter((r) => r.session_date.startsWith(monthKey)))}
      {view === 'table' && renderTable(reels)}
      {view === 'upcoming' && (up.length ? <ul className="space-y-2">{up.map((r) => { const d = Math.round((new Date(r.session_date).getTime() - new Date(today).getTime()) / 86400000); return <li key={r.id} className="card flex items-center justify-between gap-3 p-3"><div><p className="font-medium text-brand-900">{r.presenter_name}{r.topic ? ` — ${r.topic}` : ''}</p><p className="text-xs text-slate-500">{r.weekday}, {fmtDate(r.session_date)}</p></div><Badge tone={d <= data.settings.alerts.reel_reminder_days ? 'amber' : 'blue'}>{d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}</Badge></li>; })}</ul> : <Empty title="No upcoming sessions" hint="All scheduled sessions are in the past. Add the next round of sessions." action={admin ? <button className="btn-primary" onClick={() => setEdit({ status: 'Planned', session_date: today })}>Add session</button> : undefined} />)}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartBox title="Sessions by speaker" height={Math.max(240, presenterData.length * 26 + 60)}><HBar data={presenterData} /></ChartBox>
        <ChartBox title="Sessions by month">{monthData.length ? <VBar data={monthData} series={['Completed', 'Planned', 'Not recorded', 'Postponed', 'Cancelled']} colors={['#2E9E5B', '#1F6FC9', '#9AA5B1', '#E8A317', '#DC2626']} /> : <Empty title="No data" />}</ChartBox>
        <ChartBox title="Topic distribution" subtitle="Topics are blank in the source plan until filled in" height={Math.max(240, topicData.length * 26 + 60)}><HBar data={topicData} color="#4F8FDB" /></ChartBox>
      </div>

      {edit && <ReelForm init={edit} admin={!edit.id ? admin : ed(edit as Reel)} isAdm={isAdm} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />}
      {img && <ReelImageModal r={img} today={today} onClose={() => setImg(null)} />}
      <Confirm open={!!del} danger title="Delete session" confirmLabel="Delete" onClose={() => setDel(null)} message={<>Delete the session of <b>{del?.presenter_name}</b> on {del && fmtDate(del.session_date)}? To keep the history, mark it Cancelled instead.</>} onConfirm={async () => { try { await api(`/api/reels/${del!.id}`, { method: 'DELETE' }); toast('Deleted'); setDel(null); refresh(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </>
  );
}

function ReelForm({ init, admin, isAdm, onClose, onSaved }: { init: Partial<Reel>; admin: boolean; isAdm: boolean; onClose: () => void; onSaved: () => void }) {
  const { data } = useApp(); const toast = useToast(); const isNew = !init.id;
  const [f, setF] = useState({ employee_id: init.employee_id ?? '', presenter_code: init.presenter_code ?? '', presenter_name: init.presenter_name ?? '', session_date: init.session_date ?? '', weekday: init.weekday ?? '', topic: init.topic ?? '', software: init.software ?? '', status: (init.status ?? 'Planned') as ReelStatus, notes: init.notes ?? '', link: init.link ?? '' });
  const wd = f.session_date ? weekdayOf(f.session_date) : '';
  const mismatch = f.weekday && wd && f.weekday !== wd;
  const same = data.reels.filter((r) => r.session_date === f.session_date && r.id !== init.id && r.status !== 'Cancelled');
  const pick = (id: string) => { const e = data.employees.find((x) => x.id === id); setF({ ...f, employee_id: id, presenter_code: e?.employee_code ?? '', presenter_name: e?.name ?? f.presenter_name }); };
  const save = async () => {
    try {
      const body = { employee_id: f.employee_id || null, presenter_code: f.presenter_code || null, presenter_name: f.presenter_name, session_date: f.session_date, weekday: f.weekday || wd, topic: f.topic || null, software: f.software || null, status: f.status, notes: f.notes || null, link: f.link || null };
      const r: any = isNew ? await api('/api/reels', { body }) : await api(`/api/reels/${init.id}`, { method: 'PATCH', body });
      toast(r?.mail === 'sent' ? 'Saved — speaker notified by e-mail' : r?.mail === 'failed' ? 'Saved, but the e-mail could not be sent' : r?.mail === 'off' ? 'Saved — e-mail notifications are not set up yet (SMTP_USER / SMTP_PASS)' : 'Saved'); onSaved();
    } catch (e: any) { toast(e.message, 'err'); }
  };
  const d = !admin;
  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Add BIM Reel session' : d ? 'BIM Reel session' : 'Edit BIM Reel session'} footer={<><button className="btn-secondary" onClick={onClose}>{d ? 'Close' : 'Cancel'}</button>{!d && <button className="btn-primary" disabled={!f.presenter_name || !f.session_date || !!mismatch} onClick={save}>Save</button>}</>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Speaker (from org chart)"><select className="input" disabled={d} value={f.employee_id} onChange={(e) => pick(e.target.value)}><option value="">— other / not in org chart —</option>{data.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <Field label="Speaker"><input className="input" disabled={d} value={f.presenter_name} onChange={(e) => setF({ ...f, presenter_name: e.target.value })} /></Field>
        <Field label="Status" hint={isAdm ? undefined : 'Only the Administrator changes the status.'}><select className="input" disabled={d || !isAdm} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ReelStatus })}>{REEL_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Date"><input type="date" className="input" disabled={d} value={f.session_date} onChange={(e) => setF({ ...f, session_date: e.target.value, weekday: '' })} /></Field>
        <Field label="Weekday" hint={wd ? `This date is a ${wd}.` : undefined}><select className="input" disabled={d} value={f.weekday || wd} onChange={(e) => setF({ ...f, weekday: e.target.value })}><option value="">—</option>{WD.map((w) => <option key={w}>{w}</option>)}</select></Field>
        {mismatch && <p className="sm:col-span-2 rounded bg-red-50 p-2 text-sm text-red-700">The selected weekday ({f.weekday}) does not match the date ({wd}). <button className="underline" onClick={() => setF({ ...f, weekday: wd })}>Use {wd}</button></p>}
        {same.length > 0 && <p className="sm:col-span-2 rounded bg-amber-50 p-2 text-sm text-amber-800">⚠ Conflict: another session is already scheduled that day ({same.map((s) => s.presenter_name).join(', ')}).</p>}
        <Field label="Topic"><input className="input" disabled={d} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
        <Field label="Software"><select className="input" disabled={d} value={f.software} onChange={(e) => setF({ ...f, software: e.target.value })}><option value="">—</option>{SOFTWARES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Meeting / recording link"><input className="input" disabled={d} placeholder="https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
        <Field label="Notes / outcome"><input className="input" disabled={d} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ReelImageModal({ r, today, onClose }: { r: Reel; today: string; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const toast = useToast();
  const ls = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const keep = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
  const [time, setTime] = useState(() => ls('reelImgTime', '10:00')); const [link, setLink] = useState(() => ls('reelImgLink', DEFAULT_MEETING_LINK)); const [to, setTo] = useState(() => ls('reelImgTo', DEFAULT_REEL_TO)); const [cc, setCc] = useState(() => ls('reelImgCc', DEFAULT_REEL_CC));
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
  const day = r.session_date === today ? 'Today' : new Date(r.session_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const when = (r.session_date === today ? 'today' : new Date(r.session_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })) + ` at ${to12(time || '10:00')}`;
  const info = { topic: r.topic ?? '', speaker: r.presenter_name, day, time: to12(time || '10:00'), link: link.trim() || null };
  useEffect(() => { if (ref.current) drawReelImage(ref.current, info); }); // eslint-disable-line react-hooks/exhaustive-deps
  // 0.5 = half the pixel size, so the picture pastes into the e-mail at 50%
  const png = () => new Promise<Blob>((res, rej) => { const cv = document.createElement('canvas'); drawReelImage(cv, info, 0.5); cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the image'))), 'image/png'); });
  const remember = () => { keep('reelImgTime', time); keep('reelImgLink', link); keep('reelImgTo', to); keep('reelImgCc', cc); };
  const mail = () => reelMailContent({ topic: info.topic, when, link: info.link });
  // Opens Outlook (the default mail app) directly; the picture is put on the clipboard so it can be pasted into the body.
  const openOutlook = async () => {
    remember(); const c = mail(); let copied = false;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]); copied = true; } catch {}
    const recipients = toAddresses(to).join(';');
    const ccs = toAddresses(cc).join(';');
    window.location.href = `mailto:${recipients}?${ccs ? `cc=${encodeURIComponent(ccs)}&` : ''}subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.text)}`;
    toast(copied ? 'Outlook is opening — click in the message body and press Ctrl+V to paste the picture' : 'Outlook is opening — the picture could not be copied; use “Formatted file” instead', copied ? undefined : 'err');
  };
  const copyImage = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]); toast('Image copied — paste it (Ctrl+V) into your e-mail'); }
    catch { toast('The browser did not allow copying the image', 'err'); }
  };
  return (
    <Modal open onClose={onClose} wide title="BIM Reel announcement" footer={<><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-secondary" onClick={copyImage}><Copy size={16} />Copy image</button><button className="btn-primary" onClick={openOutlook}><Mail size={16} />Email</button></>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-[9rem_1fr]"><Field label="Session time"><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Meeting link"><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://teams.microsoft.com/…" /></Field></div>
      <Field label="To (group e-mails, separated by ;)"><input className="input mb-3" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Name <name@company.com>; …" /></Field>
      <Field label="CC (separated by ;)"><input className="input mb-3" value={cc} onChange={(e) => setCc(e.target.value)} /></Field>
      <p className="mb-3 text-xs text-slate-500"><b>Email</b> opens a new message in Outlook with the recipients, subject (BIM Reel | topic) and text, and copies the picture — click in the message body and press <b>Ctrl+V</b>. <b>Copy image</b> only copies the picture.</p>
      <canvas ref={ref} className="w-full rounded border border-slate-200" style={{ aspectRatio: `${REEL_IMG_W}/${REEL_IMG_H}` }} />
    </Modal>
  );
}
