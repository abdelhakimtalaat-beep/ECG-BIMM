'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Confirm, Modal, Spinner, useToast } from './ui';
import { api, fmtDateTime } from '@/lib/client';
import { summarize } from '@/lib/accSummary';
import { readExtractZip } from '@/lib/accZipBrowser';

interface St { configured: boolean; connected: boolean; connection: { hub_name: string | null; connected_by: string | null; connected_at: string | null; last_sync_at: string | null; last_status: string | null; last_error: string | null } | null; projects: { acc_project_id: string; name: string; synced_at: string; portal_project_id: string | null }[]; requests?: { acc_project_id: string; project_name: string; last_status: string | null; last_error: string | null; request_id?: string | null; once_request_id?: string | null }[] }

/** Administration > ACC: connect the Autodesk account once; the portal then imports the Data Connector extract every day. */
export function AccAdmin() {
  const toast = useToast(); const [s, setS] = useState<St | null>(null); const [busy, setBusy] = useState(false); const [off, setOff] = useState(false);
  const load = useCallback(async () => { try { setS(await api<St>('/api/acc/status')); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); const m = new URLSearchParams(location.search).get('acc'); if (m) { toast(m.startsWith('connected') ? 'ACC ' + m : m, m.startsWith('connected') && !/failed|skipped/.test(m) ? 'ok' : 'err'); history.replaceState(null, '', '/admin'); } }, [load, toast]);
  const run = async (request_now: boolean) => { setBusy(true); try { let r: { message: string; more?: boolean } = { message: '' }; for (let i = 0; i < 8; i++) { r = await api<{ message: string; more?: boolean }>('/api/acc/sync', { body: { request_now: request_now && i === 0 } }); if (!r.more) break; } toast(r.message); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const [diag, setDiag] = useState<string | null>(null); const [pick, setPick] = useState(false);
  const diagnose = async () => { setBusy(true); try { const r = await api<{ text: string }>('/api/acc/diagnose', { body: {} }); setDiag(r.text); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const setup = async () => { setBusy(true); try { const r = await api<{ message: string }>('/api/acc/setup', { body: {} }); toast(r.message); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const upload = async (f: File | undefined) => {
    if (!f) return; setBusy(true);
    try {
      const files = await readExtractZip(await f.arrayBuffer());
      if (!files['issues_issues.csv'] && !files['admin_projects.csv']) throw new Error('This zip does not look like an ACC Data Connector extract (no issues or projects file found)');
      const stats = summarize(files, new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }));
      if (!stats.length) throw new Error('No projects were found in this extract');
      const r = await api<{ projects: number; newly_linked: number }>('/api/acc/upload', { body: { stats } });
      toast(`Imported ${r.projects} project(s); ${r.newly_linked} newly linked`); await load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  if (!s) return <Spinner />; const c = s.connection;
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-600">Reads the project statistics (issues, reviews, clash tests) from Autodesk Construction Cloud. A Project Admin schedules a daily Data Connector extract in ACC; the portal finds every project that has extraction data and imports the newest finished extract automatically every day at 08:00 (Cairo time). Only totals are stored per project, per role and per assignee (assignee names as shown in ACC); no e-mail addresses.</p>
      {!s.configured && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Not set up yet: add <b>APS_CLIENT_ID</b>, <b>APS_CLIENT_SECRET</b> and <b>CRON_SECRET</b> in the Vercel project settings (Environment Variables), then redeploy. The callback address to register in the Autodesk app is <code>{typeof location !== 'undefined' ? `${location.origin}/api/acc/callback` : ''}</code></div>}
      <div className="card space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>Status:</b> {s.connected ? <Badge tone="green">Connected</Badge> : <Badge tone="gray">Not connected</Badge>}{c?.last_status === 'reconnect' && <Badge tone="red">Sign in again</Badge>}{c?.hub_name && <span className="text-slate-600">Hub: {c.hub_name}</span>}</div>
        {c?.connected_at && <p className="text-slate-600">Connected by {c.connected_by} on {fmtDateTime(new Date(c.connected_at))}</p>}
        {c?.last_sync_at && <p className="text-slate-600">Last check: {fmtDateTime(new Date(c.last_sync_at))} — {c.last_status}</p>}
        {c?.last_error && <p className="text-red-600">{c.last_error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <a className={`btn-primary ${!s.configured ? 'pointer-events-none opacity-50' : ''}`} href="/api/acc/connect">{s.connected ? 'Reconnect ACC' : 'Connect ACC'}</a>
          {s.connected && <><button className="btn-secondary" disabled={busy} onClick={() => setPick(true)} title="Lists the ACC projects that have extraction data, so you can import them">Show extracted projects</button><button className="btn-secondary" disabled={busy} onClick={() => run(false)} title="Finds every project with extraction data in ACC and imports its newest extract (this also runs by itself every day at 08:00 Cairo time)">Import now</button><button className="btn-secondary" disabled={busy} onClick={diagnose} title="Shows what Autodesk answers for the first tracked project (read only)">Diagnose</button><button className="btn-ghost text-red-600" onClick={() => setOff(true)}>Disconnect</button></>}
        </div>
        {s.connected && <details className="text-xs text-slate-600"><summary className="cursor-pointer">Advanced: let the portal create the Autodesk schedule itself</summary>
          <p className="mt-1">Normally a Project Admin schedules the daily extract inside ACC and the portal only imports it. If a project has no schedule, the portal can create one, but Autodesk allows only a few such requests per day for your user.</p>
          <div className="mt-1 flex gap-2"><button className="btn-secondary btn-sm" disabled={busy} onClick={setup}>Create daily schedules</button><button className="btn-secondary btn-sm" disabled={busy} onClick={() => run(true)}>Request one-time extracts</button></div></details>}
        {busy && <Spinner />}
        {diag && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">{diag}</pre>}
      </div>
      {s.connected && <div className="card p-4"><h3 className="mb-2 text-sm font-semibold text-brand-900">Imported / detected projects ({s.requests?.length ?? 0})</h3>
        {!s.requests?.length ? <p className="text-sm text-slate-500">None yet. Press “Import now” or “Show extracted projects”; projects with extraction data are found automatically.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.requests.map((r) => <li key={r.acc_project_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span>{r.project_name}</span>{r.last_status === 'error' ? <span className="text-xs text-red-600">{r.last_error}</span> : r.last_status === 'waiting' && r.last_error ? <span className="text-xs text-amber-700">{r.last_error}</span> : r.last_status === 'imported' ? <span className="flex items-center gap-2"><Badge tone="green">Imported</Badge>{r.last_error && <span className="text-xs text-amber-700">{r.last_error}</span>}</span> : r.once_request_id || r.request_id ? <Badge tone="blue">Waiting for the first finished extract</Badge> : <Badge tone="gray">Tracked - imported when an extract exists in ACC</Badge>}</li>)}</ul>}</div>}
      <div className="card space-y-2 p-4 text-sm"><h3 className="text-sm font-semibold text-brand-900">Upload an ACC extract (no connection needed)</h3>
        <p className="text-slate-600">In ACC create a Data Connector extract, download its zip and choose it here. The file is read in your browser; only totals per project, role and assignee are sent to the portal (no e-mail addresses).</p>
        <input type="file" accept=".zip,application/zip" disabled={busy} className="block text-sm" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} /></div>
      <div className="card p-4"><h3 className="mb-2 text-sm font-semibold text-brand-900">ACC projects found ({s.projects.length})</h3>
        {s.projects.length === 0 ? <p className="text-sm text-slate-500">None yet. They appear after the first import.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.projects.map((p) => <li key={p.acc_project_id} className="flex items-center justify-between py-1.5"><span>{p.name || p.acc_project_id}</span>{p.portal_project_id ? <Badge tone="green">Linked</Badge> : <Badge tone="amber">Not linked — open the project in the Portfolio to link it</Badge>}</li>)}</ul>}
      </div>
      {pick && <Picker onClose={() => setPick(false)} onDone={load} />}
      <Confirm open={off} danger title="Disconnect ACC" message="The stored Autodesk sign-in is deleted. The statistics already imported stay." confirmLabel="Disconnect" onClose={() => setOff(false)} onConfirm={async () => { setOff(false); try { await api('/api/acc/disconnect', { body: {} }); toast('Disconnected'); load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>);
}

interface ExRow { id: string; name: string; daily: boolean; date: string; requests: number; matches: boolean; imported: boolean }
/** Lists the ACC projects that have extraction data; the ticked ones are imported now (and from then on every day). */
function Picker({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [rows, setRows] = useState<ExRow[] | null>(null); const [sel, setSel] = useState<Set<string>>(new Set()); const [qs, setQs] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ projects: ExRow[] }>('/api/acc/extracted').then((r) => { setRows(r.projects); setSel(new Set(r.projects.map((p) => p.id))); }).catch((e) => { toast(e.message, 'err'); onClose(); }); /* eslint-disable-next-line */ }, []);
  const shown = (rows ?? []).filter((p) => p.name.toLowerCase().includes(qs.trim().toLowerCase()));
  const toggle = (id: string) => setSel((x) => { const n = new Set(x); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const old = (d: string) => !!d && Date.now() - Date.parse(d) > 3 * 86400000;
  const go = async () => {
    setBusy(true);
    try { const projects = (rows ?? []).filter((p) => sel.has(p.id)).map((p) => ({ id: p.id, name: p.name })); let r: { message: string; more?: boolean } = { message: '' };
      for (let i = 0; i < 8; i++) { r = await api<{ message: string; more?: boolean }>('/api/acc/sync', { body: { projects } }); if (!r.more) break; }
      toast(r.message); onDone(); onClose(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} wide title="ACC projects with extraction data" footer={<><span className="mr-auto self-center text-sm text-slate-600">{sel.size} of {rows?.length ?? 0} selected</span><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" disabled={busy || !sel.size} onClick={go}>{busy ? 'Importing…' : `Import ${sel.size} project(s)`}</button></>}>
      {!rows ? <Spinner /> : <div className="space-y-3">
        <p className="text-sm text-slate-600">These ACC projects have extraction data (an extract that Autodesk has run). Tick the ones to import now. Every day at 08:00 (Cairo time) the portal also finds and imports all of them by itself.</p>
        <div className="flex flex-wrap items-center gap-2"><input className="input w-64" placeholder="Search…" value={qs} onChange={(e) => setQs(e.target.value)} />
          <button className="btn-ghost btn-sm" onClick={() => setSel((x) => new Set([...x, ...shown.map((p) => p.id)]))}>Select shown</button>
          <button className="btn-ghost btn-sm" onClick={() => setSel((x) => { const n = new Set(x); shown.forEach((p) => n.delete(p.id)); return n; })}>Clear shown</button>
          <button className="btn-ghost btn-sm" title="Tick only the projects whose name starts with a portal project number" onClick={() => setSel(new Set(rows.filter((p) => p.matches).map((p) => p.id)))}>Only projects in the portal</button></div>
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 text-sm">
          {shown.map((p) => <li key={p.id}><label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50"><input type="checkbox" className="mt-1 h-4 w-4" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
            <span className="flex-1"><span className="block">{p.name}</span><span className="block text-xs text-slate-500">Last extract: {p.date || '—'}{old(p.date) ? ' (old)' : ''}</span></span>
            <span className="flex shrink-0 gap-1">{p.matches && <Badge tone="blue">In portal</Badge>}{p.daily ? <Badge tone="green">Daily extract</Badge> : <Badge tone="amber">One-time extract</Badge>}{p.imported && <Badge tone="gray">Imported</Badge>}</span></label></li>)}
          {!shown.length && <li className="px-3 py-4 text-slate-500">{rows.length ? 'No project matches.' : 'No project with extraction data was found. In ACC, a Project Admin must schedule or run a Data Connector extract.'}</li>}
        </ul></div>}
    </Modal>);
}
