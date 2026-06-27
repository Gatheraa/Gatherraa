"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface SalesDataPoint {
  date: string;
  tickets: number;
  revenue: number;
}

type ChartView = "area" | "bar";
type Range = "7d" | "30d" | "90d" | "1y";

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-border-default rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-text-muted font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-text-secondary capitalize">{p.name}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums text-text-primary">
            {p.name === "revenue" ? `$${p.value.toLocaleString()}` : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
};

const ALL_DATA: SalesDataPoint[] = [
  { date: "Jan 1", tickets: 28, revenue: 980 },
  { date: "Jan 8", tickets: 42, revenue: 1470 },
  { date: "Jan 15", tickets: 35, revenue: 1225 },
  { date: "Jan 22", tickets: 60, revenue: 2100 },
  { date: "Jan 29", tickets: 78, revenue: 2730 },
  { date: "Feb 5", tickets: 55, revenue: 1925 },
  { date: "Feb 12", tickets: 90, revenue: 3150 },
  { date: "Feb 19", tickets: 110, revenue: 3850 },
  { date: "Feb 26", tickets: 95, revenue: 3325 },
  { date: "Mar 5", tickets: 120, revenue: 4200 },
  { date: "Mar 12", tickets: 145, revenue: 5075 },
  { date: "Mar 19", tickets: 130, revenue: 4550 },
  { date: "Mar 26", tickets: 160, revenue: 5600 },
  { date: "Apr 2", tickets: 175, revenue: 6125 },
  { date: "Apr 9", tickets: 155, revenue: 5425 },
  { date: "Apr 16", tickets: 200, revenue: 7000 },
  { date: "Apr 23", tickets: 220, revenue: 7700 },
  { date: "Apr 30", tickets: 195, revenue: 6825 },
  { date: "May 7", tickets: 240, revenue: 8400 },
  { date: "May 14", tickets: 260, revenue: 9100 },
  { date: "May 21", tickets: 245, revenue: 8575 },
  { date: "May 28", tickets: 280, revenue: 9800 },
  { date: "Jun 4", tickets: 310, revenue: 10850 },
  { date: "Jun 11", tickets: 295, revenue: 10325 },
  { date: "Jun 18", tickets: 330, revenue: 11550 },
  { date: "Jun 25", tickets: 355, revenue: 12425 },
];

const RANGE_SLICE: Record<Range, number> = {
  "7d": 1,
  "30d": 4,
  "90d": 13,
  "1y": ALL_DATA.length,
};

type SeriesKey = "tickets" | "revenue";

interface LegendPayloadItem {
  value: string;
  color: string;
}

interface CustomLegendProps {
  payload?: LegendPayloadItem[];
  activeSeries: Set<SeriesKey>;
  toggle: (key: SeriesKey) => void;
}

function CustomLegend({ payload, activeSeries, toggle }: CustomLegendProps) {
  if (!payload?.length) return null;
  return (
    <div className="flex gap-4 justify-end pb-2">
      {payload.map((p) => {
        const key = p.value as SeriesKey;
        const active = activeSeries.has(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${active ? "opacity-100" : "opacity-35"}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-text-secondary capitalize">{key}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface TicketSalesTrendProps {
  data?: SalesDataPoint[];
  className?: string;
}

export function TicketSalesTrend({
  data = ALL_DATA,
  className = "",
}: TicketSalesTrendProps) {
  const [view, setView] = useState<ChartView>("area");
  const [range, setRange] = useState<Range>("30d");
  const [activeSeries, setActiveSeries] = useState<Set<SeriesKey>>(
    new Set(["tickets", "revenue"])
  );

  const chartData = useMemo(() => {
    const count = RANGE_SLICE[range];
    return data.slice(-count);
  }, [data, range]);

  const toggle = (key: SeriesKey) => {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size === 1) return prev;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const series = useMemo(
    () =>
      [
        { key: "tickets" as const, color: "#3b82f6" },
        { key: "revenue" as const, color: "#10b981" },
      ].filter((s) => activeSeries.has(s.key)),
    [activeSeries]
  );

  const axisStyle = {
    fill: "var(--text-muted)",
    fontSize: 12,
    fontFamily: "inherit",
  };

  const sharedProps = {
    data: chartData,
    margin: { top: 4, right: 8, left: -8, bottom: 0 },
  };

  const sharedAxis = (
    <>
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        stroke="var(--border-default)"
      />
      <XAxis
        dataKey="date"
        tick={axisStyle}
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
      />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Legend
        content={
          <CustomLegend
            activeSeries={activeSeries}
            toggle={toggle}
            payload={[
              { value: "tickets", color: "#3b82f6" },
              { value: "revenue", color: "#10b981" },
            ]}
          />
        }
      />
    </>
  );

  return (
    <div
      className={`bg-surface rounded-xl border border-border-default p-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Ticket Sales Trend
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {RANGE_LABELS[range]} overview
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Range selector */}
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1 border border-border-default">
            {(["7d", "30d", "90d", "1y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                  range === r
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Chart type toggle */}
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1 border border-border-default">
            <button
              onClick={() => setView("area")}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 ${
                view === "area"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
              aria-label="Area chart"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M1 13 5 7l3 3 4-5 3 2v4H1z" />
              </svg>
            </button>
            <button
              onClick={() => setView("bar")}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 ${
                view === "bar"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
              aria-label="Bar chart"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <rect x="1" y="8" width="3" height="6" rx="1" />
                <rect x="6" y="4" width="3" height="10" rx="1" />
                <rect x="11" y="2" width="3" height="12" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {view === "area" ? (
            <AreaChart {...sharedProps}>
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
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {sharedAxis}
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart {...sharedProps}>
              {sharedAxis}
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TicketSalesTrend;
