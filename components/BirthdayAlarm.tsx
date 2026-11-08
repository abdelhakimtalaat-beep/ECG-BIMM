'use client';
import { useEffect, useState } from 'react';
import { Cake, X } from 'lucide-react';
import { api } from '@/lib/client';

interface Hit { id: string; name: string; date: string; turning: number; days: number }
/** Administrator alarm: shown on every page while an employee of the org chart has a birthday today (dismiss it for the day). */
export function BirthdayAlarm() {
  const [d, setD] = useState<{ today: string; birthdays_today: Hit[]; upcoming: Hit[] } | null>(null); const [hidden, setHidden] = useState(false);
  useEffect(() => {
    api<any>('/api/birthdays').then((x) => { setD(x); try { setHidden(localStorage.getItem(`bdayDismissed:${x.today}`) === '1'); } catch {} }).catch(() => {});
  }, []);
  if (!d || hidden || !d.birthdays_today.length) return null;
  const close = () => { setHidden(true); try { localStorage.setItem(`bdayDismissed:${d.today}`, '1'); } catch {} };
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <Cake size={22} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Birthday today{d.birthdays_today.length > 1 ? 's' : ''}: {d.birthdays_today.map((h) => `${h.name} (${h.turning})`).join(' · ')}</p>
        {d.upcoming.length > 0 && <p className="mt-0.5 text-xs text-amber-800">Coming up: {d.upcoming.map((h) => `${h.name} — ${h.days === 1 ? 'tomorrow' : `in ${h.days} days`}`).join(' · ')}</p>}
      </div>
      <button className="btn-ghost btn-sm" aria-label="Dismiss for today" onClick={close}><X size={16} /></button>
    </div>
  );
}
