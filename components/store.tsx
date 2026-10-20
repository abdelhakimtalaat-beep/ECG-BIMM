'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, todayLocal } from '@/lib/client';
import { applyProjectFilters, applyReelFilters } from '@/lib/metrics';
import { EMPTY_FILTERS, type Dataset, type Employee, type Filters, type Me, type Project, type Reel } from '@/lib/types';

interface Ctx {
  me: Me; data: Dataset; refresh: () => Promise<void>; today: string;
  filters: Filters; setFilters: (f: Partial<Filters>) => void; resetFilters: () => void;
  projects: Project[]; reels: Reel[];             // filtered
  emp: Map<string, Employee>;
}
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error('useApp outside provider'); return c; };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ me: Me; data: Dataset } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setF] = useState<Filters>(EMPTY_FILTERS);
  const today = useMemo(() => todayLocal(), []);

  const refresh = useCallback(async () => {
    try { const r = await api<{ me: Me; data: Dataset }>('/api/data'); setState(r); setErr(null); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { refresh(); try { const s = sessionStorage.getItem('ecg_filters'); if (s) setF({ ...EMPTY_FILTERS, ...JSON.parse(s) }); } catch {} }, [refresh]);
  useEffect(() => { try { sessionStorage.setItem('ecg_filters', JSON.stringify(filters)); } catch {} }, [filters]);

  const projects = useMemo(() => (state ? applyProjectFilters(state.data, filters) : []), [state, filters]);
  const reels = useMemo(() => (state ? applyReelFilters(state.data.reels, filters, state.data.employees) : []), [state, filters]);
  const emp = useMemo(() => new Map((state?.data.employees ?? []).map((e) => [e.id, e])), [state]);

  if (err && !state) return <div className="p-10 text-center"><p className="text-red-600">Could not load data: {err}</p><button className="btn-primary mt-4" onClick={refresh}>Retry</button></div>;
  if (!state) return <div className="flex h-screen items-center justify-center text-slate-500"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /><span className="ml-3">Loading…</span></div>;
  return (
    <C.Provider value={{ ...state, refresh, today, filters, setFilters: (f) => setF((o) => ({ ...o, ...f })), resetFilters: () => setF(EMPTY_FILTERS), projects, reels, emp }}>
      {children}
    </C.Provider>
  );
}
