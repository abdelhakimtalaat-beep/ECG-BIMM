'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/client';
import { TAB_LIST } from '@/lib/tabs';
import { Badge, Spinner, useToast } from './ui';

interface Guest { id: string; email: string; full_name: string | null; active: boolean; last_login_at: string | null }
interface Resp { cfg: { enabled: boolean; tabs: string[]; domains: string[] }; guests: Guest[] }
const GROUPS = [
  { label: 'Projects', hrefs: ['/projects', '/projects/map', '/process-map', '/acc-stats', '/teams', '/proposals'] },
  { label: 'BIMMers', hrefs: ['/tasks', '/vacations', '/meetings', '/evaluation'] },
  { label: 'Training', hrefs: ['/reels', '/courses'] },
];
const SENSITIVE = new Set(['/org', '/contacts', '/vacations', '/evaluation', '/tasks']);
const label = (h: string) => TAB_LIST.find((t) => t.href === h)?.label ?? h;

/** Administration > General access: sign-in with a one-time password for everyone who has the link, read-only, on the tabs chosen here. */
export function GuestAccessAdmin() {
  const toast = useToast(); const [d, setD] = useState<Resp | null>(null); const [on, setOn] = useState(false); const [domains, setDomains] = useState(''); const [tabs, setTabs] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false);
  const apply = (r: Resp) => { setD(r); setOn(r.cfg.enabled); setDomains(r.cfg.domains.join('\n')); setTabs(new Set(r.cfg.tabs)); };
  const load = useCallback(() => api<Resp>('/api/guest-access').then(apply).catch((e) => toast(e.message, 'err')), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Spinner />;
  const grouped = new Set(GROUPS.flatMap((g) => g.hrefs)); const top = TAB_LIST.map((t) => t.href as string).filter((h) => !grouped.has(h) && h !== '/admin');
  const setMany = (hs: string[], v: boolean) => setTabs((x) => { const n = new Set(x); hs.forEach((h) => (v ? n.add(h) : n.delete(h))); return n; });
  const Row = ({ h }: { h: string }) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={tabs.has(h)} onChange={(e) => setMany([h], e.target.checked)} />{label(h)}{SENSITIVE.has(h) && <span className="text-xs text-amber-700">(personal data)</span>}</label>;
  const save = async () => { setBusy(true); try { apply(await api<Resp>('/api/guest-access', { method: 'PUT', body: { enabled: on, domains, tabs: [...tabs] } })); toast('General access saved'); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const block = async (g: Guest) => { try { apply(await api<Resp>('/api/guest-access', { method: 'PUT', body: { set_active: { id: g.id, active: !g.active } } })); } catch (e: any) { toast(e.message, 'err'); } };
  return (
    <div className="max-w-3xl space-y-4">
      <div className="card space-y-4 p-4">
        <div><h2 className="font-semibold text-brand-900">General access (read only)</h2>
          <p className="mt-1 text-sm text-slate-600">Anyone who opens the portal link can ask for a one-time password (OTP) at their e-mail address, enter it, and view the tabs you tick below. They cannot change anything and cannot see the other tabs.</p></div>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => setOn(e.target.checked)} />Allow general access with a one-time password</label>
        <div><label className="label" htmlFor="gdom">Allowed e-mail domains (one per line)</label>
          <textarea id="gdom" className="input h-20 font-mono text-sm" placeholder="ecgsa.com" value={domains} onChange={(e) => setDomains(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Only e-mail addresses of these domains can get a code. <b>Leave it empty to let any e-mail address in.</b> Staff who already have a portal account keep signing in with their password.</p></div>
        <div><p className="mb-2 text-sm font-medium">Tabs and sub-tabs visible with general access</p>
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="flex gap-2 text-xs"><button type="button" className="btn-secondary btn-sm" onClick={() => setMany(TAB_LIST.map((t) => t.href as string).filter((h) => h !== '/admin'), true)}>Select all</button><button type="button" className="btn-secondary btn-sm" onClick={() => setTabs(new Set())}>Clear</button></div>
            <div className="grid gap-1 sm:grid-cols-2">{top.map((h) => <Row key={h} h={h} />)}</div>
            {GROUPS.map((g) => <div key={g.label}><label className="flex items-center gap-2 text-sm font-semibold text-brand-900"><input type="checkbox" className="h-4 w-4" checked={g.hrefs.every((h) => tabs.has(h))} onChange={(e) => setMany(g.hrefs, e.target.checked)} />{g.label}</label>
              <div className="ml-6 mt-1 grid gap-1 sm:grid-cols-2">{g.hrefs.map((h) => <Row key={h} h={h} />)}</div></div>)}
          </div>
          <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">Think before ticking tabs marked "personal data" (staff names, phone numbers, vacations, tasks): everyone who can receive a code can read them. Administration, HR files, imports and exports are never available with general access.</p></div>
        <div className="flex items-center gap-3"><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>{on && !tabs.size && <span className="text-xs text-amber-700">No tab is ticked, so guests would see nothing.</span>}</div>
      </div>
      <div className="card overflow-x-auto p-4">
        <h3 className="mb-2 font-semibold text-brand-900">People who signed in with a code ({d.guests.length})</h3>
        {!d.guests.length ? <p className="text-sm text-slate-500">Nobody yet.</p> : <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><th className="p-2">E-mail</th><th className="p-2">Last sign-in</th><th className="p-2" /></tr></thead>
          <tbody>{d.guests.map((g) => <tr key={g.id} className="border-b border-slate-100"><td className="p-2">{g.email} {!g.active && <Badge tone="red">Blocked</Badge>}</td><td className="p-2 text-slate-600">{g.last_login_at ? fmtDateTime(new Date(g.last_login_at)) : '—'}</td><td className="p-2 text-right"><button className="btn-secondary btn-sm" onClick={() => block(g)}>{g.active ? 'Block' : 'Unblock'}</button></td></tr>)}</tbody></table>}
      </div>
    </div>);
}
