'use client';
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { api, saveBlob } from '@/lib/client';
import { FIELDS } from '@/lib/importer';
import { csvEscape } from '@/lib/importer';
import { useApp } from './store';
import { Badge, Modal, Spinner, useToast } from './ui';

const LABEL: Record<string, string> = { manager: 'BIM Manager', coordinator: 'BIM Coordinator', project_no: 'Project No.', name: 'Project Name', cde: 'CDE', type: 'Type', area: 'Built-Up Area', status: 'Status', activity: 'Active / Not Active flag' };
type Sheet = { name: string; headers: (string | null)[]; rows: any[][]; mapping: Record<string, number | null> };

export function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useApp(); const toast = useToast();
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<{ filename: string; sheets: Sheet[] } | null>(null);
  const [si, setSi] = useState(0); const [map, setMap] = useState<Record<string, number | null>>({});
  const [res, setRes] = useState<any>(null);
  const reset = () => { setFile(null); setParsed(null); setRes(null); setMap({}); setSi(0); };
  const sheet = parsed?.sheets[si];
  const body = (dryRun: boolean) => ({ filename: parsed!.filename, mapping: map, rows: sheet!.rows, dryRun });

  const preview = async () => {
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', file!); const r = await api('/api/import/preview', { raw: fd }); setParsed(r); const best = r.sheets.findIndex((s: Sheet) => s.mapping.name != null); setSi(Math.max(0, best)); setMap(r.sheets[Math.max(0, best)].mapping); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const validate = async () => { setBusy(true); try { setRes(await api('/api/import/commit', { body: body(true) })); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const commit = async () => { setBusy(true); try { const r = await api('/api/import/commit', { body: body(false) }); setRes({ ...r, done: true }); toast(`Imported ${r.summary.new} project(s)`); refresh(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const report = () => {
    const rows = [['Line', 'Name', 'Result', 'Messages'], ...res.results.map((r: any) => [r.line, r.name ?? '', r.status, r.messages.join(' | ')])];
    saveBlob(new Blob(['﻿' + rows.map((r: any[]) => r.map(csvEscape).join(',')).join('\r\n')], { type: 'text/csv' }), 'import-report.csv');
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} wide title="Import projects from Excel / CSV"
      footer={<><button className="btn-secondary" onClick={() => { reset(); onClose(); }}>{res?.done ? 'Close' : 'Cancel'}</button>
        {parsed && !res && <button className="btn-primary" disabled={busy || map.name == null} onClick={validate}>Validate (no changes yet)</button>}
        {res && !res.done && <button className="btn-primary" disabled={busy || res.summary.new === 0} onClick={commit}>Import {res.summary.new} new project(s)</button>}</>}>
      {!parsed && <div className="space-y-3"><p className="text-sm text-slate-600">Upload the department workbook (.xlsx) or a .csv file. You will see a preview and a validation report before anything is saved. Existing projects are never overwritten — duplicates are reported and skipped.</p>
        <input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block text-sm" />
        <button className="btn-primary" disabled={!file || busy} onClick={preview}><Upload size={15} />Read file</button>{busy && <Spinner label="Reading file…" />}</div>}
      {parsed && !res && sheet && <div className="space-y-4">
        {parsed.sheets.length > 1 && <div><label className="label">Worksheet</label><select className="input" value={si} onChange={(e) => { const i = Number(e.target.value); setSi(i); setMap(parsed.sheets[i].mapping); }}>{parsed.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({s.rows.length} rows)</option>)}</select></div>}
        <div><p className="label">Map source columns to portal fields</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{FIELDS.map((f) => (
          <div key={f} className="flex items-center gap-2"><span className="w-40 text-sm">{LABEL[f]}{f === 'name' && <span className="text-red-500"> *</span>}</span>
            <select className="input" value={map[f] ?? ''} onChange={(e) => setMap({ ...map, [f]: e.target.value === '' ? null : Number(e.target.value) })}><option value="">(not imported)</option>{sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}</select></div>))}</div></div>
        <div><p className="label">Preview (first 5 rows of {sheet.rows.length})</p><div className="overflow-x-auto rounded border border-slate-200"><table className="w-full text-xs"><thead><tr>{sheet.headers.map((h, i) => <th key={i} className="th">{h || `Col ${i + 1}`}</th>)}</tr></thead><tbody>{sheet.rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t">{sheet.headers.map((_, j) => <td key={j} className="td">{String(r[j] ?? '')}</td>)}</tr>)}</tbody></table></div></div></div>}
      {res && <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm"><Badge tone="green">{res.summary.new} new</Badge><Badge tone="amber">{res.summary.duplicate} duplicate (skipped)</Badge><Badge>{res.summary.ignored} ignored (blank / subtotal)</Badge><Badge tone="blue">{res.summary.withWarnings} new with warnings</Badge></div>
        {res.done && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">Import complete. Warnings were saved to Administration → Data quality.</p>}
        <div className="max-h-72 overflow-auto rounded border border-slate-200"><table className="w-full text-xs"><thead><tr><th className="th">Line</th><th className="th">Project</th><th className="th">Result</th><th className="th">Notes</th></tr></thead><tbody>{res.results.filter((r: any) => r.status !== 'new' || r.messages.length).map((r: any) => <tr key={r.line} className="border-t align-top"><td className="td">{r.line}</td><td className="td">{r.name}</td><td className="td">{r.status}</td><td className="td">{r.messages.join('; ')}</td></tr>)}</tbody></table></div>
        <button className="btn-secondary btn-sm" onClick={report}>Download report (CSV)</button></div>}
    </Modal>
  );
}
