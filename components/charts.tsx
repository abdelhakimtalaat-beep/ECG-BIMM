'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STATUS_COLORS, STATUSES } from '@/lib/types';

export const BLUES = ['#0B2545', '#0F55A8', '#1F6FC9', '#4F8FDB', '#8DB9EA', '#B9D5F4'];
const axis = { fontSize: 12, fill: '#475569' };

export function ChartBox({ title, subtitle, children, height = 280, action }: { title: string; subtitle?: string; children: React.ReactNode; height?: number; action?: React.ReactNode }) {
  return (
    <section className="card p-4" aria-label={title}>
      <div className="mb-2 flex items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-brand-900">{title}</h3>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div>{action}</div>
      <div style={{ height }}>{children}</div>
    </section>
  );
}
export interface Datum { key: string; name: string; value: number; [k: string]: any }

/** Horizontal bars; `onPick(key)` makes each bar a filter control. */
export function HBar({ data, onPick, color = '#1F6FC9', activeKeys = [], mean, unit = '' }: { data: Datum[]; onPick?: (key: string) => void; color?: string; activeKeys?: string[]; mean?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#E2E8F0" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={118} tick={axis} interval={0} />
        <Tooltip formatter={(v: any) => [Number(v).toLocaleString('en-US') + unit, '']} separator="" cursor={{ fill: '#EEF5FD' }} />
        {mean != null && <ReferenceLine x={mean} stroke="#E8A317" strokeDasharray="4 3" label={{ value: 'avg', fontSize: 11, fill: '#B45309', position: 'top' }} />}
        <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor={onPick ? 'pointer' : undefined} onClick={(d: any) => onPick?.(d.key)}>
          {data.map((d) => <Cell key={d.key} fill={activeKeys.length && !activeKeys.includes(d.key) ? '#B9D5F4' : color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
export function StatusStack({ data, onPick, activeKeys = [] }: { data: ({ key: string; name: string } & Record<string, any>)[]; onPick?: (key: string) => void; activeKeys?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#E2E8F0" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={118} tick={axis} interval={0} />
        <Tooltip cursor={{ fill: '#EEF5FD' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
        {STATUSES.map((s) => (
          <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]} cursor={onPick ? 'pointer' : undefined} onClick={(d: any) => onPick?.(d.key)}>
            {data.map((d) => <Cell key={d.key} fill={STATUS_COLORS[s]} fillOpacity={activeKeys.length && !activeKeys.includes(d.key) ? 0.35 : 1} />)}
          </Bar>))}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, colors, onPick, activeKeys = [] }: { data: Datum[]; colors: (key: string, i: number) => string; onPick?: (key: string) => void; activeKeys?: string[] }) {
  const total = data.reduce((t, d) => t + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} cursor={onPick ? 'pointer' : undefined} onClick={(d: any) => onPick?.(d.key)}
          label={(p: any) => (p.value ? `${p.value}` : '')} labelLine={false}>
          {data.map((d, i) => <Cell key={d.key} fill={colors(d.key, i)} fillOpacity={activeKeys.length && !activeKeys.includes(d.key) ? 0.35 : 1} />)}
        </Pie>
        <Tooltip formatter={(v: any, n: any) => [`${v} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]} /><Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
export function VBar({ data, series, colors }: { data: ({ name: string } & Record<string, any>)[]; series: string[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#E2E8F0" /><XAxis dataKey="name" tick={axis} /><YAxis tick={axis} allowDecimals={false} /><Tooltip cursor={{ fill: '#EEF5FD' }} /><Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => <Bar key={s} dataKey={s} stackId="a" fill={colors[i]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Trend({ data }: { data: ({ name: string } & Record<string, any>)[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="#E2E8F0" /><XAxis dataKey="name" tick={axis} /><YAxis tick={axis} allowDecimals={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
        {STATUSES.map((s) => <Line key={s} type="monotone" dataKey={s} stroke={STATUS_COLORS[s]} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
