'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { X, ChevronDown, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { STATUS_BG, STATUS_DOT } from '@/lib/client';
import type { Status } from '@/lib/types';

// ------------------------------------------------------------------ toast
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random(); setItems((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={clsx('rounded-lg px-4 py-3 text-sm text-white shadow-lg', t.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600')}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// --------------------------------------------------------------- primitives
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_BG[status], className)}><span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[status] }} />{status}</span>;
}
export function Badge({ children, tone = 'gray', title }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'amber' | 'red' | 'green'; title?: string }) {
  const t = { gray: 'bg-slate-100 text-slate-700', blue: 'bg-brand-100 text-brand-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', green: 'bg-emerald-100 text-emerald-800' }[tone];
  return <span title={title} className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', t)}>{children}</span>;
}
export function Spinner({ label }: { label?: string }) { return <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{label ?? 'Loading…'}</div>; }
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="font-medium text-slate-700">{title}</p>{hint && <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-brand-900">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div><div className="no-print flex flex-wrap gap-2">{actions}</div></div>;
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>;
}
export function Tip({ text, children }: { text: string; children: React.ReactNode }) { return <span title={text} className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2">{children}</span>; }

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx('card w-full', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="text-base font-semibold text-brand-900">{title}</h2><button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, children, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={title} className={clsx('flex h-full w-full flex-col bg-white shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><h2 className="truncate text-base font-semibold text-brand-900">{title}</h2><button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }: { open: boolean; title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return <Modal open={open} onClose={onClose} title={title} footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button disabled={busy} className={danger ? 'btn-danger' : 'btn-primary'} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</button></>}><div className="text-sm text-slate-700">{message}</div></Modal>;
}

// ------------------------------------------------------------ multi select
export function MultiSelect({ label, options, value, onChange, width = 'w-44' }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; width?: string }) {
  const [open, setOpen] = useState(false); const [term, setTerm] = useState(''); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const shown = options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase()));
  return (
    <div className={clsx('relative', width)} ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={clsx('flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm', value.length ? 'border-brand-500 text-brand-800' : 'border-slate-300 text-slate-600')}>
        <span className="truncate">{value.length ? `${label}: ${value.length}` : label}</span><ChevronDown size={14} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          {options.length > 8 && <input autoFocus className="input mb-2" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} />}
          {value.length > 0 && <button className="mb-1 text-xs text-brand-600 hover:underline" onClick={() => onChange([])}>Clear</button>}
          {shown.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-brand-50">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => onChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])} />{o.label}
            </label>
          ))}
          {!shown.length && <p className="px-2 py-1 text-xs text-slate-500">No matches</p>}
        </div>
      )}
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" value={value} placeholder={placeholder ?? 'Search…'} onChange={(e) => onChange(e.target.value)} aria-label={placeholder ?? 'Search'} /></div>;
}

// ----------------------------------------------------------------- table
export interface Col<T> { key: string; header: string; render?: (r: T) => React.ReactNode; sort?: (r: T) => string | number | null; className?: string; hideBelow?: 'md' | 'lg' }
export function DataTable<T>({ rows, cols, rowKey, onRow, pageSize = 25, empty, selectable, selected, onSelect, initialSort }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; pageSize?: number; empty?: React.ReactNode;
  selectable?: boolean; selected?: Set<string>; onSelect?: (s: Set<string>) => void; initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const sorted = useMemo(() => {
    if (!sort) return rows; const c = cols.find((x) => x.key === sort.key); if (!c?.sort) return rows; const f = c.sort;
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); return sort.dir === 'asc' ? r : -r; });
  }, [rows, sort, cols]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize)); const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * pageSize, cur * pageSize + pageSize);
  if (!rows.length) return <>{empty ?? <Empty title="Nothing to show" />}</>;
  const allOn = selectable && view.length > 0 && view.every((r) => selected?.has(rowKey(r)));
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr>
            {selectable && <th className="th w-8"><input type="checkbox" aria-label="Select page" checked={!!allOn} onChange={() => { const s = new Set(selected); view.forEach((r) => (allOn ? s.delete(rowKey(r)) : s.add(rowKey(r)))); onSelect?.(s); }} /></th>}
            {cols.map((c) => (
              <th key={c.key} className={clsx('th', c.hideBelow === 'md' && 'hidden md:table-cell', c.hideBelow === 'lg' && 'hidden lg:table-cell', c.sort && 'cursor-pointer select-none')} onClick={() => c.sort && setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                <span className="inline-flex items-center gap-1">{c.header}{sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
              </th>))}
          </tr></thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={rowKey(r)} className={clsx('border-t border-slate-100', i % 2 ? 'bg-slate-50/60' : 'bg-white', onRow && 'cursor-pointer hover:bg-brand-50')} onClick={() => onRow?.(r)}>
                {selectable && <td className="td" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={!!selected?.has(rowKey(r))} onChange={() => { const s = new Set(selected); s.has(rowKey(r)) ? s.delete(rowKey(r)) : s.add(rowKey(r)); onSelect?.(s); }} /></td>}
                {cols.map((c) => <td key={c.key} className={clsx('td', c.className, c.hideBelow === 'md' && 'hidden md:table-cell', c.hideBelow === 'lg' && 'hidden lg:table-cell')}>{c.render ? c.render(r) : String((r as any)[c.key] ?? '—')}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <span>{sorted.length} record{sorted.length === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2"><button className="btn-secondary btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button><span>Page {cur + 1} / {pages}</span><button className="btn-secondary btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button></div>
      </div>
    </div>
  );
}
