"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartType = "area" | "line" | "bar";

export interface MetricDataPoint {
  label: string;
  users?: number;
  revenue?: number;
  [key: string]: string | number | undefined;
}

export interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change: number; // % change, positive or negative
  prefix?: string;
  suffix?: string;
}

export interface AnalyticsWidgetProps {
  title?: string;
  subtitle?: string;
  metrics?: MetricCard[];
  chartData?: MetricDataPoint[];
  chartType?: ChartType;
  /** Which keys from chartData to plot */
  series?: { key: string; label: string; color: string }[];
  className?: string;
}

// ─── Default demo data ────────────────────────────────────────────────────────

const DEFAULT_METRICS: MetricCard[] = [
  {
    id: "users",
    title: "Total Users",
    value: "128,402",
    change: +12.4,
    prefix: "",
  },
  {
    id: "revenue",
    title: "Revenue",
    value: "94,210",
    change: +8.1,
    prefix: "$",
  },
  { id: "conv", title: "Conversion", value: "3.68", change: -1.2, suffix: "%" },
  { id: "session", title: "Avg. Session", value: "4m 22s", change: +5.6 },
];

const DEFAULT_DATA: MetricDataPoint[] = [
  { label: "Jan", users: 4200, revenue: 6100 },
  { label: "Feb", users: 5800, revenue: 7400 },
  { label: "Mar", users: 5100, revenue: 6800 },
  { label: "Apr", users: 7300, revenue: 9200 },
  { label: "May", users: 8900, revenue: 11500 },
  { label: "Jun", users: 8100, revenue: 10200 },
  { label: "Jul", users: 10400, revenue: 13800 },
  { label: "Aug", users: 11200, revenue: 15100 },
  { label: "Sep", users: 9800, revenue: 13400 },
  { label: "Oct", users: 12600, revenue: 17200 },
  { label: "Nov", users: 14100, revenue: 19800 },
  { label: "Dec", users: 15300, revenue: 21400 },
];

const DEFAULT_SERIES = [
  { key: "users", label: "Users", color: "#6366f1" },
  { key: "revenue", label: "Revenue", color: "#10b981" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Trend({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      <svg
        className={`w-3 h-3 ${!up && "rotate-180"}`}
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M6 2l4 6H2l4-6z" />
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-md px-4 py-3 shadow-2xl text-sm">
      <p className="text-white/50 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-white/70 capitalize">{p.name}</span>
          <span className="ml-auto pl-4 text-white font-semibold tabular-nums">
            {p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart renderer ───────────────────────────────────────────────────────────

function ChartRenderer({
  type,
  data,
  series,
}: {
  type: ChartType;
  data: MetricDataPoint[];
  series: typeof DEFAULT_SERIES;
}) {
  const common = {
    data,
    margin: { top: 8, right: 8, left: -24, bottom: 0 },
  };

  const axisStyle = { fill: "#ffffff30", fontSize: 11, fontFamily: "inherit" };
  const gridStyle = { stroke: "#ffffff0d" };

  const sharedChildren = (
    <>
      <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false} />
      <XAxis
        dataKey="label"
        tick={axisStyle}
        axisLine={false}
        tickLine={false}
      />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip
        content={<CustomTooltip />}
        cursor={{ stroke: "#ffffff15", strokeWidth: 1 }}
      />
    </>
  );

  if (type === "bar") {
    return (
      <BarChart {...common}>
        {sharedChildren}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    );
  }

  if (type === "line") {
    return (
      <LineChart {...common}>
        {sharedChildren}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    );
  }

  // area (default)
  return (
    <AreaChart {...common}>
      <defs>
        {series.map((s) => (
          <linearGradient
            key={s.key}
            id={`grad-${s.key}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {sharedChildren}
      {series.map((s) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={s.color}
          strokeWidth={2}
          fill={`url(#grad-${s.key})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      ))}
    </AreaChart>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsWidget({
  title = "Analytics Overview",
  subtitle = "Last 12 months",
  metrics = DEFAULT_METRICS,
  chartData = DEFAULT_DATA,
  chartType: initialChartType = "area",
  series = DEFAULT_SERIES,
  className = "",
}: AnalyticsWidgetProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    new Set(series.map((s) => s.key)),
  );

  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size === 1) return prev; // keep at least one
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const visibleSeries = series.filter((s) => activeSeries.has(s.key));

  const chartTypes: { type: ChartType; icon: React.ReactNode }[] = [
    {
      type: "area",
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M1 13L5 7l3 3 4-5 3 2v4H1z" />
        </svg>
      ),
    },
    {
      type: "line",
      icon: (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-3.5 h-3.5"
        >
          <polyline points="1,12 5,6 9,9 13,3 15,5" />
        </svg>
      ),
    },
    {
      type: "bar",
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <rect x="1" y="8" width="3" height="6" rx="1" />
          <rect x="6" y="4" width="3" height="10" rx="1" />
          <rect x="11" y="2" width="3" height="12" rx="1" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-[#0c0e14] border border-white/[0.06]
        text-white shadow-[0_0_80px_rgba(0,0,0,0.6)]
        font-[system-ui,_sans-serif]
        ${className}
      `}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-emerald-600/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            {title}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
        </div>

        {/* Chart-type toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.05] p-1">
          {chartTypes.map(({ type, icon }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 ${
                chartType === type
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/30 hover:text-white/60"
              }`}
              aria-label={`${type} chart`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04] border-b border-white/[0.06]">
        {metrics.map((m) => (
          <div key={m.id} className="bg-[#0c0e14] px-5 py-4">
            <p className="text-xs text-white/40 mb-1.5 truncate">{m.title}</p>
            <p className="text-xl font-bold tabular-nums tracking-tight">
              {m.prefix}
              {m.value}
              {m.suffix}
            </p>
            <div className="mt-1.5">
              <Trend value={m.change} />
              <span className="ml-1.5 text-xs text-white/30">
                vs last period
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="relative px-5 pt-5 pb-2">
        {/* Series toggles */}
        <div className="flex flex-wrap gap-3 mb-4">
          {series.map((s) => {
            const active = activeSeries.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggleSeries(s.key)}
                className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${
                  active ? "opacity-100" : "opacity-30"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-white/70">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="h-52 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ChartRenderer
              type={chartType}
              data={chartData}
              series={visibleSeries}
            />
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between border-t border-white/[0.06]">
        <span className="text-xs text-white/25">Updated just now</span>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
          View full report →
        </button>
      </div>
    </div>
  );
}
