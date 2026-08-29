import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { CHART_COLORS, formatMoney } from '../format';

const axisStyle = { fontSize: 11, fill: 'var(--muted)' };

function ChartTooltip({ active, payload, label, currency = 'usd' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      {label !== undefined && <div style={{ marginBottom: 6, color: 'var(--muted)' }}>{label}</div>}
      {payload.map((entry: any) => (
        <div key={entry.dataKey ?? entry.name} className="row between" style={{ gap: 14 }}>
          <span style={{ color: entry.color ?? entry.payload?.fill }}>
            {entry.name ?? entry.payload?.name}
          </span>
          <strong>{formatMoney(entry.value, currency)}</strong>
        </div>
      ))}
    </div>
  );
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function Donut({
  data,
  center,
  height = 260,
}: {
  data: DonutSlice[];
  center?: ReactNode;
  height?: number;
}) {
  return (
    <div style={{ position: 'relative', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((slice, index) => (
              <Cell key={slice.name} fill={slice.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="donut-center">{center}</div>}
    </div>
  );
}

export function TrendArea({
  data,
  dataKey = 'value',
  xKey = 'label',
  color = 'var(--accent)',
  height = 240,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value) => formatMoney(value)}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CashflowBars({
  data,
  incomeLabel,
  expenseLabel,
  height = 280,
}: {
  data: Array<{ label: string; income: number; expense: number }>;
  incomeLabel: string;
  expenseLabel: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value) => formatMoney(value)}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--panel-2)' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="income" name={incomeLabel} fill="var(--accent)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="expense" name={expenseLabel} fill="var(--danger)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetLine({
  data,
  label,
  height = 240,
}: {
  data: Array<{ label: string; net: number }>;
  label: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value) => formatMoney(value)}
        />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="net"
          name={label}
          stroke="var(--info)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
