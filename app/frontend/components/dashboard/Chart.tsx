'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
  type LegendProps,
} from 'recharts';
import { Loader2 } from 'lucide-react';

// Color palette
const COLORS = [
  '#2563eb', // Primary blue
  '#16a34a', // Success green
  '#d97706', // Warning amber
  '#dc2626', // Error red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
];

export type ChartType = 'bar' | 'line' | 'pie' | 'area';

export interface ChartDataPoint {
  [key: string]: string | number | undefined;
}

export interface ChartSeries {
  dataKey: string;
  name?: string;
  color?: string;
  type?: 'monotone' | 'linear' | 'step';
  strokeWidth?: number;
  fillOpacity?: number;
}

export interface ChartProps {
  type: ChartType;
  data: ChartDataPoint[];
  series?: ChartSeries[];
  xAxisKey?: string;
  title?: string;
  description?: string;
  height?: number;
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animateOnLoad?: boolean;
  animationDuration?: number;
  className?: string;
  onDataPointClick?: (data: ChartDataPoint, index: number) => void;
  // Pie specific
  innerRadius?: number;
  outerRadius?: number;
  // Custom colors
  colors?: string[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => [string, string];
}

function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface-elevated border border-border-default rounded-lg shadow-lg p-3">
      {label && (
        <p className="text-sm font-semibold text-text-primary mb-2">{label}</p>
      )}
      {payload.map((entry, index) => (
        <p key={index} className="text-sm text-text-secondary flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium text-text-primary">
            {formatter ? formatter(entry.value, entry.name)[0] : entry.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: LegendProps) {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-text-secondary">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Chart({
  type,
  data,
  series = [],
  xAxisKey = 'name',
  title,
  description,
  height = 300,
  loading = false,
  showGrid = true,
  showLegend = false,
  showTooltip = true,
  animateOnLoad = true,
  animationDuration = 1000,
  className = '',
  onDataPointClick,
  innerRadius = 0,
  outerRadius = 100,
  colors = COLORS,
}: ChartProps) {
  const [mounted, setMounted] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (animateOnLoad) {
      const timer = setTimeout(() => setAnimationComplete(true), animationDuration);
      return () => clearTimeout(timer);
    } else {
      setAnimationComplete(true);
    }
  }, [animateOnLoad, animationDuration]);

  const handleClick = useCallback((data: ChartDataPoint, index: number) => {
    onDataPointClick?.(data, index);
  }, [onDataPointClick]);

  // Get the default series if none provided
  const chartSeries = useMemo(() => {
    if (series.length > 0) return series;
    
    if (data.length > 0 && type !== 'pie') {
      const firstKey = Object.keys(data[0]).find(k => k !== xAxisKey);
      if (firstKey) {
        return [{ dataKey: firstKey, name: firstKey }];
      }
    }
    return series;
  }, [series, data, type, xAxisKey]);

  // Animation props
  const animationProps = useMemo(() => ({
    isAnimationActive: animateOnLoad && mounted && !animationComplete,
    animationDuration,
    animationBegin: 0,
  }), [animateOnLoad, mounted, animationComplete, animationDuration]);

  if (!mounted) {
    return (
      <div className={`bg-surface rounded-xl border border-border-default p-6 ${className}`}>
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const chartContent = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend />} />}
            {chartSeries.map((s, index) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                fill={s.color || colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
                onClick={(data, index) => handleClick(data, index)}
                cursor={onDataPointClick ? 'pointer' : 'default'}
                {...animationProps}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend />} />}
            {chartSeries.map((s, index) => (
              <Line
                key={s.dataKey}
                type={s.type || 'monotone'}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color || colors[index % colors.length]}
                strokeWidth={s.strokeWidth || 2}
                dot={{ fill: s.color || colors[index % colors.length], r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                onClick={(data, index) => handleClick(data, index)}
                cursor={onDataPointClick ? 'pointer' : 'default'}
                {...animationProps}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={{ stroke: 'var(--border-default)' }}
            />
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend />} />}
            {chartSeries.map((s, index) => (
              <Area
                key={s.dataKey}
                type={s.type || 'monotone'}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color || colors[index % colors.length]}
                fill={s.color || colors[index % colors.length]}
                fillOpacity={s.fillOpacity || 0.2}
                onClick={(data, index) => handleClick(data, index)}
                cursor={onDataPointClick ? 'pointer' : 'default'}
                {...animationProps}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            {showTooltip && <Tooltip content={<CustomTooltip />} />}
            {showLegend && <Legend content={<CustomLegend />} />}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              dataKey={chartSeries[0]?.dataKey || 'value'}
              nameKey={xAxisKey}
              onClick={(data, index) => handleClick(data as unknown as ChartDataPoint, index)}
              cursor={onDataPointClick ? 'pointer' : 'default'}
              {...animationProps}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-surface rounded-xl border border-border-default p-6 ${className}`}>
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-text-muted mt-1">{description}</p>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {chartContent()}
        </ResponsiveContainer>
      )}
    </div>
  );
}

// Convenience components for specific chart types
export function BarChartComponent(props: Omit<ChartProps, 'type'>) {
  return <Chart type="bar" {...props} />;
}

export function LineChartComponent(props: Omit<ChartProps, 'type'>) {
  return <Chart type="line" {...props} />;
}

export function PieChartComponent(props: Omit<ChartProps, 'type'>) {
  return <Chart type="pie" {...props} />;
}

export function AreaChartComponent(props: Omit<ChartProps, 'type'>) {
  return <Chart type="area" {...props} />;
}

export default Chart;
