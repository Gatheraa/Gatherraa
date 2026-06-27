'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, UserCheck, TrendingUp } from 'lucide-react';
import { Event } from '../../../lib/api/events';

interface AttendanceAnalyticsWidgetProps {
  event: Event;
}

export default function AttendanceAnalyticsWidget({ event }: AttendanceAnalyticsWidgetProps) {
  const { registeredCount = 0, attendanceCount = 0 } = event;
  const missingCount = Math.max(0, registeredCount - attendanceCount);
  
  // Handle edge case where no one is registered
  const attendancePercentage = registeredCount > 0 
    ? Math.round((attendanceCount / registeredCount) * 100) 
    : 0;

  const data = [
    { name: 'Checked-in', value: attendanceCount, color: '#10b981' }, // emerald-500
    { name: 'Not Checked-in', value: missingCount, color: '#6366f1' }, // indigo-500
  ];

  // If there are no registrations, we show an empty placeholder chart
  const displayData = registeredCount > 0 ? data : [{ name: 'No Data', value: 1, color: '#e5e7eb' }];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Attendance Analytics</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Organizer Dashboard Insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Cards */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Registered</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {registeredCount}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Checked-in</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {attendanceCount}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Attendance Rate</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {attendancePercentage}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="md:col-span-2 h-64 sm:h-72 w-full flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          {registeredCount > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {displayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>No registration data available yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
