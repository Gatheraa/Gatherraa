'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsData {
  month: string;
  earnings: number;
}

interface EarningsChartProps {
  data: EarningsData[];
}

export default function EarningsChart({ data }: EarningsChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:hidden" />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" className="hidden dark:block" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '16px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}
            itemStyle={{ color: '#3B82F6' }}
            labelStyle={{ color: '#F3F4F6', fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="#3B82F6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorEarnings)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
