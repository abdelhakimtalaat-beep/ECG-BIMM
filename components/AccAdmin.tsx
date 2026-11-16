'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Confirm, Spinner, useToast } from './ui';
import { api, fmtDateTime } from '@/lib/client';

interface St { configured: boolean; connected: boolean; connection: { hub_name: string | null; connected_by: string | null; connected_at: string | null; last_sync_at: string | null; last_status: string | null; last_error: string | null } | null; projects: { acc_project_id: string; name: string; synced_at: string; portal_project_id: string | null }[] }

/** Administration > ACC: connect the Autodesk account once; the portal then imports the Data Connector extract every day. */
export function AccAdmin() {
  const toast = useToast(); const [s, setS] = useState<St | null>(null); const [busy, setBusy] = useState(false); const [off, setOff] = useState(false);
  const load = useCallback(async () => { try { setS(await api<St>('/api/acc/status')); } catch (e: any) { toast(e.message, 'err'); } }, [toast]);
  useEffect(() => { load(); const m = new URLSearchParams(location.search).get('acc'); if (m) { toast(m === 'connected' ? 'ACC connected' : m, m === 'connected' ? 'ok' : 'err'); history.replaceState(null, '', '/admin'); } }, [load, toast]);
  const run = async (request_now: boolean) => { setBusy(true); try { const r = await api<{ message: string }>('/api/acc/sync', { body: { request_now } }); toast(r.message); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  if (!s) return <Spinner />; const c = s.connection;
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-600">Reads the project statistics (issues, reviews, clash tests) from Autodesk Construction Cloud through the Data Connector, once a day. Only totals are stored; no names or e-mail addresses of ACC users.</p>
      {!s.configured && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Not set up yet: add <b>APS_CLIENT_ID</b>, <b>APS_CLIENT_SECRET</b> and <b>CRON_SECRET</b> in the Vercel project settings (Environment Variables), then redeploy. The callback address to register in the Autodesk app is <code>{typeof location !== 'undefined' ? `${location.origin}/api/acc/callback` : ''}</code></div>}
      <div className="card space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>Status:</b> {s.connected ? <Badge tone="green">Connected</Badge> : <Badge tone="gray">Not connected</Badge>}{c?.last_status === 'reconnect' && <Badge tone="red">Sign in again</Badge>}{c?.hub_name && <span className="text-slate-600">Hub: {c.hub_name}</span>}</div>
        {c?.connected_at && <p className="text-slate-600">Connected by {c.connected_by} on {fmtDateTime(new Date(c.connected_at))}</p>}
        {c?.last_sync_at && <p className="text-slate-600">Last check: {fmtDateTime(new Date(c.last_sync_at))} — {c.last_status}</p>}
        {c?.last_error && <p className="text-red-600">{c.last_error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <a className={`btn-primary ${!s.configured ? 'pointer-events-none opacity-50' : ''}`} href="/api/acc/connect">{s.connected ? 'Reconnect ACC' : 'Connect ACC'}</a>
          {s.connected && <><button className="btn-secondary" disabled={busy} onClick={() => run(false)}>Import now</button><button className="btn-secondary" disabled={busy} onClick={() => run(true)} title="Asks Autodesk to prepare a fresh extract (takes some minutes), then press Import now">Request extract now</button><button className="btn-ghost text-red-600" onClick={() => setOff(true)}>Disconnect</button></>}
        </div>
        {busy && <Spinner />}
      </div>
      <div className="card p-4"><h3 className="mb-2 text-sm font-semibold text-brand-900">ACC projects found ({s.projects.length})</h3>
        {s.projects.length === 0 ? <p className="text-sm text-slate-500">None yet. They appear after the first import.</p> : <ul className="divide-y divide-slate-100 text-sm">{s.projects.map((p) => <li key={p.acc_project_id} className="flex items-center justify-between py-1.5"><span>{p.name || p.acc_project_id}</span>{p.portal_project_id ? <Badge tone="green">Linked</Badge> : <Badge tone="amber">Not linked — open the project in the Portfolio to link it</Badge>}</li>)}</ul>}
      </div>
      <Confirm open={off} danger title="Disconnect ACC" message="The stored Autodesk sign-in is deleted. The statistics already imported stay." confirmLabel="Disconnect" onClose={() => setOff(false)} onConfirm={async () => { setOff(false); try { await api('/api/acc/disconnect', { body: {} }); toast('Disconnected'); load(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>);
}
