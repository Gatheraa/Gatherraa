"use client";

import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Ticket,
  Users,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface RevenueData {
  date: string;
  revenue: number;
  ticketsSold: number;
  attendees: number;
}

interface RevenueStats {
  totalRevenue: number;
  revenueChange: number;
  totalTickets: number;
  ticketsChange: number;
  totalAttendees: number;
  attendeesChange: number;
  avgTicketPrice: number;
  avgPriceChange: number;
}

interface RevenueAnalyticsDashboardProps {
  eventId?: string;
}

const RevenueAnalyticsDashboard: React.FC<RevenueAnalyticsDashboardProps> = ({
  eventId,
}) => {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [chartData, setChartData] = useState<RevenueData[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, [eventId, period]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ period });
      if (eventId) params.set("eventId", eventId);

      const [statsRes, chartRes] = await Promise.all([
        fetch(`/api/analytics/revenue/stats?${params.toString()}`),
        fetch(`/api/analytics/revenue/trend?${params.toString()}`),
      ]);

      const statsData = await statsRes.json();
      const chartData = await chartRes.json();

      setStats(statsData);
      setChartData(chartData);
    } catch (error) {
      console.error("Failed to fetch revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const csvContent = [
      ["Date", "Revenue", "Tickets Sold", "Attendees"].join(","),
      ...chartData.map((d) =>
        [d.date, d.revenue, d.ticketsSold, d.attendees].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Revenue Analytics</h2>
          <p className="text-gray-600">
            Track ticket sales and revenue trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? "primary" : "outline"}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === "all" ? "All" : p.toUpperCase()}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatCurrency(stats.totalRevenue) : "—"}
            </div>
            {stats && stats.revenueChange !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  stats.revenueChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.revenueChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>{formatChange(stats.revenueChange)}</span>
                <span className="text-gray-500 text-xs">vs prev period</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Ticket className="w-4 h-4" />
              Tickets Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalTickets.toLocaleString() ?? "—"}
            </div>
            {stats && stats.ticketsChange !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  stats.ticketsChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.ticketsChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>{formatChange(stats.ticketsChange)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Users className="w-4 h-4" />
              Attendees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalAttendees.toLocaleString() ?? "—"}
            </div>
            {stats && stats.attendeesChange !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  stats.attendeesChange >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stats.attendeesChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>{formatChange(stats.attendeesChange)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Avg Ticket Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatCurrency(stats.avgTicketPrice) : "—"}
            </div>
            {stats && stats.avgPriceChange !== 0 && (
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  stats.avgPriceChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.avgPriceChange >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>{formatChange(stats.avgPriceChange)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tickets & Attendees Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket Sales & Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="ticketsSold"
                  name="Tickets Sold"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="attendees"
                  name="Attendees"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {chartData.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No revenue data yet
          </h3>
          <p className="text-gray-600">
            Revenue analytics will appear here once ticket sales begin.
          </p>
        </div>
      )}
    </div>
  );
};

export default RevenueAnalyticsDashboard;
