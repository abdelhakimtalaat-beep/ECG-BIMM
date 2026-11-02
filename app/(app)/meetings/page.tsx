'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ExternalLink, MapPin, RefreshCw, Search, Trash2, Video } from 'lucide-react';
import { useApp } from '@/components/store';
import { Confirm, Empty, Field, PageHeader, Spinner, useToast } from '@/components/ui';
import { api } from '@/lib/client';

interface Ev { id: string; employee_id: string; uid: string; start_at: string; end_at: string; all_day: boolean; title: string; location: string | null; organizer: string | null; teams_url: string | null; is_private: boolean; busy: boolean; masked: boolean }
interface Feed { employee_id: string; share: 'everyone' | 'managers'; last_synced_at: string | null; last_error: string | null; event_count: number }
type Range = 'today' | 'week' | '30' | 'custom';
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const ago = (iso: string | null) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default function MeetingsPage() {
  const { me, data } = useApp(); const toast = useToast();
  const privileged = me.role === 'admin' || me.role === 'bim_manager';
  const [range, setRange] = useState<Range>('week'); const [cf, setCf] = useState(ymd(new Date())); const [ct, setCt] = useState(ymd(new Date(Date.now() + 14 * 86400000)));
  const [res, setRes] = useState<{ events: Ev[]; feeds: Feed[] } | null>(null); const [busy, setBusy] = useState(false);
  const [who, setWho] = useState(''); const [teamsOnly, setTeamsOnly] = useState(false); const [q, setQ] = useState('');
  const bounds = useMemo(() => {
    const t = dayStart(new Date());
    if (range === 'today') return [t, new Date(t.getTime() + 86400000)] as const;
    if (range === 'week') return [t, new Date(t.getTime() + 7 * 86400000)] as const;
    if (range === '30') return [t, new Date(t.getTime() + 30 * 86400000)] as const;
    const a = new Date(cf + 'T00:00:00'), b = new Date(ct + 'T00:00:00'); return [isNaN(+a) ? t : a, isNaN(+b) ? new Date(t.getTime() + 86400000) : new Date(b.getTime() + 86400000)] as const;
  }, [range, cf, ct]);
  const load = useCallback(async () => {
    try { const r = await api<{ events: Ev[]; feeds: Feed[] }>(`/api/meetings?from=${encodeURIComponent(bounds[0].toISOString())}&to=${encodeURIComponent(bounds[1].toISOString())}`); setRes(r); }
    catch (e: any) { toast(e.message, 'err'); setRes((x) => x ?? { events: [], feeds: [] }); }
  }, [bounds, toast]);
  useEffect(() => { load(); }, [load]);

  const emp = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const feeds = res?.feeds ?? []; const feedBy = useMemo(() => new Map(feeds.map((f) => [f.employee_id, f])), [feeds]);
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase(); const merged = new Map<string, { ev: Ev; people: string[] }>();
    for (const e of res?.events ?? []) {
      if (who && e.employee_id !== who) continue; if (teamsOnly && !e.teams_url) continue;
      if (t && !(e.title.toLowerCase().includes(t) || (e.location ?? '').toLowerCase().includes(t) || (e.organizer ?? '').toLowerCase().includes(t))) continue;
      const k = `${e.uid}|${e.start_at}|${e.masked ? 'm' : 'f'}${e.masked ? e.employee_id : ''}`; const name = emp.get(e.employee_id)?.name ?? '—';
      const cur = merged.get(k); if (cur) cur.people.push(name); else merged.set(k, { ev: e, people: [name] });
    }
    const byDay = new Map<string, { date: Date; items: { ev: Ev; people: string[] }[] }>();
    for (const m of [...merged.values()].sort((a, b) => +new Date(a.ev.start_at) - +new Date(b.ev.start_at))) { const d = dayStart(new Date(m.ev.start_at)); const k = ymd(d); (byDay.get(k) ?? byDay.set(k, { date: d, items: [] }).get(k)!).items.push(m); }
    return [...byDay.values()];
  }, [res, who, teamsOnly, q, emp]);

  const myFeed = me.employee_id ? feedBy.get(me.employee_id) : undefined;
  const connected = useMemo(() => data.employees.filter((e) => feedBy.has(e.id)).sort((a, b) => a.name.localeCompare(b.name)), [data.employees, feedBy]);
  const syncAll = async () => { setBusy(true); try { const r: any = await api('/api/meetings/sync', { body: { all: true } }); toast(`Synced ${r.synced} calendar(s)${r.failed ? `, ${r.failed} failed` : ''}`); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };

  return (
    <div className="space-y-4">
      <PageHeader title="Meetings" subtitle="Meetings from the engineers' Outlook / Teams calendars (read-only copy of their published calendars)."
        actions={privileged && feeds.length > 0 ? <button className="btn-secondary" disabled={busy} onClick={syncAll}><RefreshCw size={16} />Sync all calendars</button> : undefined} />
      <ConnectCard me={me} employees={data.employees} feedBy={feedBy} myFeed={myFeed} onChanged={load} />

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Period">{([['today', 'Today'], ['week', 'Next 7 days'], ['30', 'Next 30 days'], ['custom', 'Custom']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`rounded-lg border px-3 py-1.5 text-sm ${range === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white hover:border-brand-500'}`}>{l}</button>)}</div>
        {range === 'custom' && <><Field label="From"><input type="date" className="input" value={cf} onChange={(e) => setCf(e.target.value)} /></Field><Field label="To"><input type="date" className="input" value={ct} onChange={(e) => setCt(e.target.value)} /></Field></>}
        <Field label="Engineer"><select className="input w-52" value={who} onChange={(e) => setWho(e.target.value)}><option value="">All connected engineers</option>{connected.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-[2.1rem] text-slate-400" /><Field label="Search"><input className="input w-56 pl-8" placeholder="Title, place, organizer" value={q} onChange={(e) => setQ(e.target.value)} /></Field></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={teamsOnly} onChange={(e) => setTeamsOnly(e.target.checked)} />Teams meetings only</label>
      </div>

      {!res ? <Spinner /> : !feeds.length ? <Empty title="No calendars connected yet" hint="Each engineer pastes the ICS link of his published Outlook calendar in the box above. The meetings then appear here." />
        : !groups.length ? <Empty title="No meetings in this period" hint="Change the period or the filters." />
        : <div className="space-y-4">{groups.map((g) => (
          <section key={ymd(g.date)} aria-label={dayLabel(g.date)}>
            <h2 className={`mb-1 text-sm font-semibold ${ymd(g.date) === ymd(new Date()) ? 'text-brand-700' : 'text-slate-700'}`}>{dayLabel(g.date)}{ymd(g.date) === ymd(new Date()) && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-normal text-white">Today</span>}</h2>
            <ul className="card divide-y divide-slate-100">{g.items.map(({ ev, people }) => (
              <li key={ev.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                <div className="w-32 shrink-0 font-medium text-slate-700">{ev.all_day ? 'All day' : `${tm(ev.start_at)} – ${tm(ev.end_at)}`}</div>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${ev.masked ? 'text-slate-500' : 'text-brand-900'}`}>{ev.title}{ev.teams_url && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-700"><Video size={12} />Teams</span>}{!ev.busy && <span className="ml-2 text-xs font-normal text-slate-500">(free)</span>}</p>
                  {(ev.location || ev.organizer) && <p className="text-xs text-slate-500">{ev.location && <><MapPin size={11} className="mr-0.5 inline" />{ev.location}</>}{ev.location && ev.organizer && ' · '}{ev.organizer && <>Organizer: {ev.organizer}</>}</p>}
                  <p className="mt-1 flex flex-wrap gap-1">{people.map((n) => <span key={n} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">{n}</span>)}</p>
                </div>
                {ev.teams_url && <a className="btn-secondary btn-sm" href={ev.teams_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Join</a>}
              </li>))}</ul>
          </section>))}</div>}

      {privileged && <details className="card p-3 text-sm"><summary className="cursor-pointer font-medium text-slate-700">Calendar connections ({connected.length} of {data.employees.filter((e) => e.active).length} active engineers connected)</summary>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-500"><th className="py-1 pr-3">Engineer</th><th className="pr-3">Last sync</th><th className="pr-3">Meetings read</th><th className="pr-3">Shown to</th><th>Status</th></tr></thead>
          <tbody>{connected.map((e) => { const f = feedBy.get(e.id)!; return <tr key={e.id} className="border-t border-slate-100"><td className="py-1 pr-3">{e.name}</td><td className="pr-3">{ago(f.last_synced_at)}</td><td className="pr-3">{f.event_count}</td><td className="pr-3">{f.share === 'everyone' ? 'Everyone' : 'Managers only'}</td><td className={f.last_error ? 'text-red-600' : 'text-green-700'}>{f.last_error ?? 'OK'}</td></tr>; })}</tbody></table></div>
        {(() => { const miss = data.employees.filter((e) => e.active && !feedBy.has(e.id)).map((e) => e.name); return miss.length ? <p className="mt-2 text-xs text-slate-500">Not connected: {miss.join(', ')}</p> : null; })()}
      </details>}
    </div>
  );
}

function ConnectCard({ me, employees, feedBy, myFeed, onChanged }: { me: any; employees: any[]; feedBy: Map<string, Feed>; myFeed?: Feed; onChanged: () => void }) {
  const toast = useToast(); const isAdmin = me.role === 'admin';
  const [target, setTarget] = useState<string>(me.employee_id ?? ''); const [url, setUrl] = useState(''); const [share, setShare] = useState<'everyone' | 'managers'>('managers'); const [busy, setBusy] = useState(false); const [del, setDel] = useState(false);
  const feed = target ? feedBy.get(target) : undefined;
  useEffect(() => { if (feed) setShare(feed.share); }, [feed?.employee_id, feed?.share]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me.employee_id && !isAdmin) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your login is not linked to an employee record, so you cannot connect a calendar. Ask the Administrator to link it.</p>;
  const save = async () => { setBusy(true); try { const r: any = await api('/api/meetings/feed', { method: 'PUT', body: { employee_id: target || undefined, url, share } }); toast(`Calendar connected — ${r.count} meetings read`); setUrl(''); onChanged(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const sync = async () => { setBusy(true); try { if (target && target !== me.employee_id) { await api('/api/meetings/sync', { body: { all: true } }); } else await api('/api/meetings/sync', { body: {} }); toast('Calendar synced'); onChanged(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2"><CalendarClock size={18} className="text-brand-600" /><h2 className="font-semibold text-brand-900">{isAdmin && target !== me.employee_id ? 'Calendar link' : 'My calendar'}</h2>
        {feed ? <span className={`rounded-full px-2 py-0.5 text-xs ${feed.last_error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{feed.last_error ? 'Problem' : 'Connected'} · {feed.event_count} meetings · synced {ago(feed.last_synced_at)}</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Not connected</span>}</div>
      {feed?.last_error && <p className="rounded bg-red-50 p-2 text-xs text-red-700" role="alert">{feed.last_error}</p>}
      {isAdmin && <Field label="Connect for"><select className="input w-64" value={target} onChange={(e) => { setTarget(e.target.value); setUrl(''); }}>{[...employees].filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name}{e.id === me.employee_id ? ' (me)' : ''}{feedBy.has(e.id) ? ' ✓' : ''}</option>)}</select></Field>}
      <Field label="ICS link of the published calendar" hint={feed ? 'A link is saved (it is never shown again). Paste a new link only to replace it.' : 'Paste the link here (it starts with https://outlook.office365.com/… and ends with .ics).'}>
        <input className="input" type="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" /></Field>
      <fieldset className="text-sm"><legend className="label">Who can see the meeting titles</legend>
        <label className="mr-6 inline-flex items-center gap-2"><input type="radio" name="share" checked={share === 'managers'} onChange={() => setShare('managers')} />Managers only <span className="text-xs text-slate-500">(others see “Busy”)</span></label>
        <label className="inline-flex items-center gap-2"><input type="radio" name="share" checked={share === 'everyone'} onChange={() => setShare('everyone')} />Everyone on the platform</label>
        <p className="mt-1 text-xs text-slate-500">Meetings marked Private in Outlook always show as “Private appointment” to others.</p></fieldset>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || !url.trim()} onClick={save}>{feed ? 'Replace link & sync' : 'Connect & sync'}</button>
        {feed && !url.trim() && <button className="btn-secondary" disabled={busy} onClick={sync}><RefreshCw size={16} />Sync now</button>}
        {feed && <button className="btn-ghost text-red-600" disabled={busy} onClick={() => setDel(true)}><Trash2 size={16} />Disconnect</button>}
      </div>
      <details className="text-sm"><summary className="cursor-pointer text-brand-700">How do I get the link?</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
          <li>Open <b>outlook.office.com</b> in your browser and go to <b>Calendar</b>.</li>
          <li>Click the gear icon ⚙ (Settings) → <b>Calendar → Shared calendars</b>.</li>
          <li>Under <b>Publish a calendar</b> choose your calendar and the detail level <b>“Can view titles and locations”</b> (or full details), then press <b>Publish</b>.</li>
          <li>Copy the <b>ICS</b> link (not the HTML link) and paste it above.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">Outlook updates published calendars slowly, so a new meeting can take a few hours to appear. Teams meetings are in the same calendar. If you do not see “Publish a calendar”, your company has switched it off.</p></details>
      <Confirm open={del} danger title="Disconnect calendar" confirmLabel="Disconnect" message="Remove the saved link and all meetings copied from this calendar? Nothing changes in Outlook." onClose={() => setDel(false)}
        onConfirm={async () => { setDel(false); try { await api(`/api/meetings/feed?employee_id=${target}`, { method: 'DELETE' }); toast('Disconnected'); onChanged(); } catch (e: any) { toast(e.message, 'err'); } }} />
    </div>
  );
}
