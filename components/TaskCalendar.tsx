'use client';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from './ui';
import { fmtDate } from '@/lib/client';
import { layoutWeek, monthOf, monthWeeks, shiftMonth, tasksOnDay, WEEKDAYS } from '@/lib/taskCalendar';
import type { Task } from '@/lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TONE: Record<string, string> = { 'Not Started': 'bg-slate-200 text-slate-800', 'In Progress': 'bg-blue-100 text-blue-900', Pending: 'bg-amber-100 text-amber-900', Completed: 'bg-green-100 text-green-900' };
const LATE = 'bg-red-100 text-red-900 ring-1 ring-red-300';
const WEEKEND = new Set([0, 6]);   /* Saturday and Friday columns are tinted */

/** Outlook-style month calendar: weeks start on Saturday, a task is a bar from its start date to its due date. */
export function TaskCalendar({ tasks, today, isLate, detail, onOpen }: { tasks: Task[]; today: string; isLate: (t: Task) => boolean; detail: (t: Task) => string; onOpen?: (t: Task) => void }) {
  const [ym, setYm] = useState(() => monthOf(today)); const [open, setOpen] = useState(true); const [dayOpen, setDayOpen] = useState<string | null>(null);
  const weeks: string[][] = useMemo(() => monthWeeks(ym.year, ym.month), [ym]); const dated: Task[] = useMemo(() => tasks.filter((t) => t.start_date || t.due_date), [tasks]);
  const noDate = tasks.length - dated.length; const go = (by: number) => setYm((v) => shiftMonth(v.year, v.month, by));
  const cls = (t: Task) => (isLate(t) ? LATE : TONE[t.status] ?? TONE['Not Started']);
  const dayTasks = dayOpen ? tasksOnDay(dated, dayOpen) : [];
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button className="flex items-center gap-2 text-sm font-semibold text-brand-800" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<CalendarDays size={16} />Calendar</button>
        {open && <><span className="ml-2 min-w-[9rem] text-sm font-medium">{MONTHS[ym.month - 1]} {ym.year}</span>
          <button className="btn-ghost btn-sm" aria-label="Previous month" onClick={() => go(-1)}><ChevronLeft size={16} /></button><button className="btn-ghost btn-sm" aria-label="Next month" onClick={() => go(1)}><ChevronRight size={16} /></button>
          <button className="btn-secondary btn-sm" onClick={() => setYm(monthOf(today))}>Today</button>
          <span className="ml-auto text-xs text-slate-500">{dated.length} task{dated.length === 1 ? '' : 's'} with dates{noDate ? ` · ${noDate} without a date (not shown)` : ''}</span></>}
      </div>
      {open && <div className="overflow-x-auto"><div className="min-w-[44rem]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-white text-center text-xs font-semibold text-slate-600">{WEEKDAYS.map((d, i) => <div key={d} className={`py-1.5 ${WEEKEND.has(i) ? 'bg-slate-50' : ''}`}>{d}</div>)}</div>
        {weeks.map((week) => { const { bars, hidden, lanes } = layoutWeek(week, dated, 3); const rows = Math.max(2, lanes);
          return (<div key={week[0]} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0" style={{ gridTemplateRows: `auto repeat(${rows}, 1.55rem) 1.25rem` }}>
            {week.map((d, i) => { const inMonth = +d.slice(5, 7) === ym.month; return (
              <button key={d} style={{ gridColumn: i + 1, gridRow: 1 }} onClick={() => setDayOpen(d)} aria-label={`${fmtDate(d)}, show tasks`} className={`border-l border-slate-200 px-1.5 pt-1 text-left text-xs first:border-l-0 hover:bg-brand-50 ${WEEKEND.has(i) ? 'bg-slate-50' : ''} ${inMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                <span className={d === today ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 font-semibold text-white' : 'font-medium'}>{+d.slice(8, 10) === 1 ? `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)}` : +d.slice(8, 10)}</span></button>); })}
            {Array.from({ length: rows + 1 }, (_, r) => week.map((d, i) => <div key={`${r}-${d}`} style={{ gridColumn: i + 1, gridRow: r + 2 }} className={`border-l border-slate-200 first:border-l-0 ${WEEKEND.has(i) ? 'bg-slate-50' : ''}`} />))}
            {bars.map((b) => (<button key={b.task.id + week[0]} style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 2 }} title={detail(b.task)} onClick={() => (onOpen ? onOpen(b.task) : setDayOpen(week[b.col]))}
              className={`z-10 mx-0.5 my-0.5 truncate px-1.5 text-left text-xs leading-5 hover:brightness-95 ${cls(b.task)} ${b.fromPrev ? 'rounded-l-none' : 'rounded-l'} ${b.toNext ? 'rounded-r-none' : 'rounded-r'}`}>{b.fromPrev ? '‹ ' : ''}{b.task.title}{b.toNext ? ' ›' : ''}</button>))}
            {hidden.map((n, i) => n > 0 && <button key={`more-${i}`} style={{ gridColumn: i + 1, gridRow: rows + 2 }} onClick={() => setDayOpen(week[i])} className="z-10 px-1.5 text-left text-xs font-medium text-brand-700 hover:underline">+{n} more</button>)}
          </div>); })}
      </div></div>}
      {dayOpen && <Modal open onClose={() => setDayOpen(null)} title={`Tasks on ${fmtDate(dayOpen)}`} footer={<button className="btn-secondary" onClick={() => setDayOpen(null)}>Close</button>}>
        {dayTasks.length ? <ul className="divide-y divide-slate-100 text-sm">{dayTasks.map((t) => <li key={t.id}><button className="flex w-full items-start justify-between gap-3 py-2 text-left hover:bg-slate-50" onClick={() => { if (onOpen) { setDayOpen(null); onOpen(t); } }}>
          <span className="min-w-0"><span className="block font-medium">{t.title}</span><span className="block text-xs text-slate-500">{detail(t)}</span></span><span className={`shrink-0 rounded px-2 py-0.5 text-xs ${cls(t)}`}>{isLate(t) ? 'Overdue' : t.status}</span></button></li>)}</ul> : <p className="text-sm text-slate-500">No tasks on this day.</p>}
      </Modal>}
    </div>
  );
}
