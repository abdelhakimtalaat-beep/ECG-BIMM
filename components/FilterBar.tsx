'use client';
import { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { distinct } from '@/lib/metrics';
import { STATUSES, type Filters, type Status } from '@/lib/types';
import { useApp } from './store';
import { MultiSelect, SearchBox } from './ui';

export function filtersToText(f: Filters, emp: Map<string, { name: string }>): string {
  const n = (ids: string[]) => ids.map((i) => emp.get(i)?.name ?? i).join(', ');
  const p: string[] = [];
  if (f.q) p.push(`text "${f.q}"`); if (f.manager.length) p.push(`BIM Manager: ${n(f.manager)}`); if (f.coordinator.length) p.push(`BIM Coordinator: ${n(f.coordinator)}`);
  if (f.member.length) p.push(`Team member: ${n(f.member)}`); if (f.status.length) p.push(`Status: ${f.status.join(', ')}`); if (f.cde.length) p.push(`CDE: ${f.cde.join(', ')}`);
  if (f.type.length) p.push(`Type: ${f.type.join(', ')}`); if (f.areaMin != null) p.push(`Area ≥ ${f.areaMin}`); if (f.areaMax != null) p.push(`Area ≤ ${f.areaMax}`);
  if (f.dateFrom) p.push(`Training from ${f.dateFrom}`); if (f.dateTo) p.push(`Training to ${f.dateTo}`);
  return p.join(' · ') || '(none)';
}
export const activeFilterCount = (f: Filters) => [f.q, f.manager.length, f.coordinator.length, f.member.length, f.status.length, f.cde.length, f.type.length, f.areaMin, f.areaMax, f.dateFrom, f.dateTo].filter((x) => x !== '' && x !== 0 && x != null).length;

export function FilterBar({ show = ['q', 'manager', 'coordinator', 'member', 'status', 'cde', 'type', 'area', 'date'] }: { show?: string[] }) {
  const { data, filters: f, setFilters, resetFilters } = useApp();
  const people = (cat: string[]) => data.employees.filter((e) => cat.includes(e.job_category)).map((e) => ({ value: e.id, label: e.name }));
  const opts = useMemo(() => ({
    mgr: data.employees.filter((e) => data.assignments.some((a) => a.employee_id === e.id && a.role === 'manager')).map((e) => ({ value: e.id, label: e.name })),
    coord: data.employees.filter((e) => data.assignments.some((a) => a.employee_id === e.id && a.role === 'coordinator')).map((e) => ({ value: e.id, label: e.name })),
    all: data.employees.map((e) => ({ value: e.id, label: e.name })),
    cde: distinct(data.projects.map((p) => p.cde)).map((v) => ({ value: v, label: v })),
    type: distinct(data.projects.map((p) => p.type)).map((v) => ({ value: v, label: v })),
  }), [data]);
  const n = activeFilterCount(f);
  const num = (v: string) => (v === '' ? null : Number(v));
  return (
    <div className="card no-print mb-5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-700"><Filter size={14} />Filters{n > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-white">{n}</span>}</span>
        {show.includes('q') && <div className="w-56"><SearchBox value={f.q} onChange={(q) => setFilters({ q })} placeholder="Project name or number" /></div>}
        {show.includes('manager') && <MultiSelect label="BIM Manager" options={opts.mgr} value={f.manager} onChange={(manager) => setFilters({ manager })} />}
        {show.includes('coordinator') && <MultiSelect label="BIM Coordinator" options={opts.coord} value={f.coordinator} onChange={(coordinator) => setFilters({ coordinator })} />}
        {show.includes('member') && <MultiSelect label="Team member" options={opts.all} value={f.member} onChange={(member) => setFilters({ member })} />}
        {show.includes('status') && <MultiSelect label="Status" width="w-36" options={STATUSES.map((s) => ({ value: s, label: s }))} value={f.status} onChange={(status) => setFilters({ status: status as Status[] })} />}
        {show.includes('cde') && <MultiSelect label="CDE" width="w-28" options={opts.cde} value={f.cde} onChange={(cde) => setFilters({ cde })} />}
        {show.includes('type') && <MultiSelect label="Type" width="w-28" options={opts.type} value={f.type} onChange={(type) => setFilters({ type })} />}
        {show.includes('area') && <div className="flex items-center gap-1 text-xs text-slate-500"><span>Area</span>
          <input type="number" min={0} className="input w-24" placeholder="min" value={f.areaMin ?? ''} onChange={(e) => setFilters({ areaMin: num(e.target.value) })} aria-label="Minimum built-up area" />–
          <input type="number" min={0} className="input w-24" placeholder="max" value={f.areaMax ?? ''} onChange={(e) => setFilters({ areaMax: num(e.target.value) })} aria-label="Maximum built-up area" /></div>}
        {show.includes('date') && <div className="flex items-center gap-1 text-xs text-slate-500"><span>Training</span>
          <input type="date" className="input w-36" value={f.dateFrom ?? ''} onChange={(e) => setFilters({ dateFrom: e.target.value || null })} aria-label="Training from" />–
          <input type="date" className="input w-36" value={f.dateTo ?? ''} onChange={(e) => setFilters({ dateTo: e.target.value || null })} aria-label="Training to" /></div>}
        <button className="btn-secondary btn-sm ml-auto" onClick={resetFilters} disabled={n === 0}><RotateCcw size={13} />Reset filters</button>
      </div>
    </div>
  );
}
