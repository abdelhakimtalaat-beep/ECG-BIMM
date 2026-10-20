'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { LayoutDashboard, Network, FolderKanban, Users, Gauge, CalendarDays, Settings, Menu, PanelLeftClose, PanelLeftOpen, LogOut, KeyRound, Search, ChevronDown } from 'lucide-react';
import { api, roleLabel } from '@/lib/client';
import { useApp } from './store';
import { Field, Modal, useToast } from './ui';

const NAV = [
  { href: '/', label: 'Executive Dashboard', short: 'Dashboard', icon: LayoutDashboard },
  { href: '/org', label: 'Department Organization Chart', short: 'Org Chart', icon: Network },
  { href: '/projects', label: 'Projects Portfolio', short: 'Projects', icon: FolderKanban },
  { href: '/teams', label: 'BIM Teams & Project Assignments', short: 'Teams & Assignments', icon: Users },
  { href: '/workload', label: 'BIM Team Workload', short: 'Workload', icon: Gauge },
  { href: '/reels', label: 'Weekly BIM Reels Plan', short: 'BIM Reels', icon: CalendarDays },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const { me, setFilters } = useApp(); const toast = useToast();
  const [collapsed, setCollapsed] = useState(false); const [mobile, setMobile] = useState(false); const [menu, setMenu] = useState(false); const [pw, setPw] = useState(false);
  const [q, setQ] = useState(''); const [cur, setCur] = useState(''); const [nxt, setNxt] = useState('');
  const items = me.role === 'admin' ? [...NAV, { href: '/admin', label: 'Administration', short: 'Administration', icon: Settings }] : NAV;
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  const logout = async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); router.push('/login'); };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setMobile(false)} title={n.label}
          className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active(n.href) ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white')}>
          <n.icon size={18} className="shrink-0" />{(!collapsed || mobile) && <span className="truncate">{n.short}</span>}
        </Link>))}
    </nav>
  );
  return (
    <div className="flex min-h-screen">
      <aside className={clsx('no-print sticky top-0 hidden h-screen flex-col bg-brand-900 transition-all md:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <div className="flex h-16 items-center justify-center border-b border-white/10 px-3"><div className="rounded-md bg-white px-2 py-1"><img src="/api/logo" alt="ECG – Engineering Consultants Group" className={clsx('object-contain', collapsed ? 'h-7 w-10' : 'h-9 w-32')} /></div></div>
        {nav}
        <button onClick={() => setCollapsed(!collapsed)} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-brand-200 hover:bg-white/10" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}</button>
      </aside>
      {mobile && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobile(false)}><aside className="flex h-full w-64 flex-col bg-brand-900" onClick={(e) => e.stopPropagation()}><div className="flex h-16 items-center justify-center border-b border-white/10"><div className="rounded-md bg-white px-2 py-1"><img src="/api/logo" alt="ECG" className="h-9 w-32 object-contain" /></div></div>{nav}</aside></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button className="btn-ghost btn-sm md:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={20} /></button>
          <form className="relative hidden max-w-md flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); setFilters({ q }); router.push('/projects'); }}>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search projects by name or number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
          </form>
          <div className="flex-1 sm:hidden"><img src="/api/logo" alt="ECG" className="h-8 object-contain" /></div>
          <div className="relative ml-auto">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" onClick={() => setMenu(!menu)} aria-expanded={menu}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{(me.full_name || me.email)[0].toUpperCase()}</span>
              <span className="hidden text-left leading-tight sm:block"><span className="block text-sm font-medium text-slate-800">{me.full_name || me.email}</span><span className="block text-xs text-slate-500">{roleLabel(me.role)}</span></span><ChevronDown size={14} />
            </button>
            {menu && <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
              <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setMenu(false); setPw(true); }}><KeyRound size={14} />Change password</button>
              <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-slate-50" onClick={logout}><LogOut size={14} />Sign out</button>
            </div>}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        <footer className="no-print border-t border-slate-200 px-6 py-3 text-xs text-slate-400">ECG BIM Department Management Portal · A Dorsch Global Company</footer>
      </div>
      <Modal open={pw} onClose={() => setPw(false)} title="Change password" footer={<><button className="btn-secondary" onClick={() => setPw(false)}>Cancel</button>
        <button className="btn-primary" onClick={async () => { try { await api('/api/auth/password', { body: { current: cur, next: nxt } }); toast('Password changed'); setPw(false); setCur(''); setNxt(''); } catch (e: any) { toast(e.message, 'err'); } }}>Save</button></>}>
        <div className="space-y-3"><Field label="Current password"><input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 10 characters."><input type="password" className="input" value={nxt} onChange={(e) => setNxt(e.target.value)} autoComplete="new-password" /></Field></div>
      </Modal>
    </div>
  );
}
