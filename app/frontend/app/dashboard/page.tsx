"use client";

import { useState } from "react";
import {
  BarChart,
  Activity,
  Users,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Plus,
  Download,
  Calendar,
  Layers,
  Search,
  Zap,
  Star as StarIcon,
} from "lucide-react";
import { type WidgetConfig } from "@/components/dashboard/Dashboard";
import ReusableDashboard from "@/components/dashboard/Dashboard";
import { Chart } from "@/components/dashboard/Chart";
import { type ActivityItem } from "@/components/dashboard/ActivityPanel";
import ActivityPanel from "@/components/dashboard/ActivityPanel";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import DataTable from "@/components/DataTable";

const DashboardPage = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const revenueData = [
    { name: "Jan", revenue: 4000, profit: 2400 },
    { name: "Feb", revenue: 3000, profit: 1398 },
    { name: "Mar", revenue: 2000, profit: 9800 },
    { name: "Apr", revenue: 2780, profit: 3908 },
    { name: "May", revenue: 1890, profit: 4800 },
    { name: "Jun", revenue: 2390, profit: 3800 },
    { name: "Jul", revenue: 3490, profit: 4300 },
  ];

  const userActivityData = [
    { name: "Mon", active: 30, inactive: 10 },
    { name: "Tue", active: 45, inactive: 15 },
    { name: "Wed", active: 38, inactive: 12 },
    { name: "Thu", active: 52, inactive: 8 },
    { name: "Fri", active: 48, inactive: 12 },
    { name: "Sat", active: 22, inactive: 5 },
    { name: "Sun", active: 18, inactive: 7 },
  ];

  const recentActivities: ActivityItem[] = [
    {
      id: "1",
      type: "success",
      title: "Project Alpha Completed",
      description:
        "The final deployment of Project Alpha was successful across all regions.",
      timestamp: Date.now() - 1000 * 60 * 15, // 15 mins ago
    },
    {
      id: "2",
      type: "payment",
      title: "Invoice Paid",
      description:
        "Account Zenith just paid invoice #INV-2024-001 ($4,250.00).",
      timestamp: Date.now() - 1000 * 60 * 120, // 2h ago
    },
    {
      id: "3",
      type: "warning",
      title: "Memory Threshold Warning",
      description: "Server Node-04 reached 85% memory utilization threshold.",
      timestamp: Date.now() - 1000 * 60 * 300, // 5h ago
    },
    {
      id: "4",
      type: "message",
      title: "New Strategy Discussion",
      description: "Sarah Jenkins started a new thread in #strategy-planning.",
      timestamp: Date.now() - 1000 * 60 * 1440, // 1d ago
    },
    {
      id: "5",
      type: "star",
      title: "System Milestone Reached",
      description: "Gatherraa reached 1,000,000 total events processed today.",
      timestamp: Date.now() - 1000 * 60 * 2880, // 2d ago
    },
  ];

  const widgets: WidgetConfig[] = [
    {
      id: "stat-revenue",
      type: "stats",
      title: "Total Revenue",
      subtitle: "vs Last Month",
      icon: DollarSign,
      colSpan: { default: 12, sm: 6, lg: 3 },
      component: (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              $45,231.89
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +12%
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Increased from $40k
          </p>
        </div>
      ),
    },
    {
      id: "stat-users",
      type: "stats",
      title: "Active Users",
      subtitle: "Current Sessions",
      icon: Users,
      colSpan: { default: 12, sm: 6, lg: 3 },
      component: (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">2,453</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +5%
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Steady growth this week
          </p>
        </div>
      ),
    },
    {
      id: "stat-orders",
      type: "stats",
      title: "Total Orders",
      subtitle: "Daily Performance",
      icon: ShoppingBag,
      colSpan: { default: 12, sm: 6, lg: 3 },
      component: (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">124</span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3 rotate-180" /> -2%
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium">
            Slight dip from yesterday
          </p>
        </div>
      ),
    },
    {
      id: "stat-growth",
      type: "stats",
      title: "Profit Margin",
      subtitle: "Annual Target",
      icon: Zap,
      colSpan: { default: 12, sm: 6, lg: 3 },
      component: (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">24.5%</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +1.2%
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: "75%" }}
            />
          </div>
        </div>
      ),
    },

    // Charts
    {
      id: "revenue-chart",
      type: "chart",
      title: "Revenue Performance",
      subtitle: "Monthly overview",
      icon: BarChart,
      colSpan: { default: 12, lg: 8 },
      rowSpan: 1,
      component: (
        <div className="p-2">
          <Chart
            type="area"
            data={revenueData}
            xAxisKey="name"
            series={[
              {
                dataKey: "revenue",
                name: "Revenue",
                color: "var(--color-primary)",
              },
            ]}
            height={300}
            showGrid={false}
          />
        </div>
      ),
      onRefresh: handleRefresh,
      loading: isRefreshing,
    },
    {
      id: "activity-panel",
      type: "activity",
      title: "Recent Activity",
      subtitle: "System events",
      icon: Activity,
      colSpan: { default: 12, lg: 4 },
      rowSpan: 2,
      component: <ActivityPanel items={recentActivities} />,
      bodyClassName: "max-h-[700px] overflow-auto",
    },

    {
      id: "user-distribution",
      type: "chart",
      title: "User Engagement",
      subtitle: "Weekly active status",
      icon: Layers,
      colSpan: { default: 12, lg: 4 },
      component: (
        <div className="p-2">
          <Chart
            type="line"
            data={userActivityData}
            xAxisKey="name"
            series={[
              {
                dataKey: "active",
                name: "Active",
                color: "var(--color-success)",
              },
              {
                dataKey: "inactive",
                name: "Inactive",
                color: "var(--color-muted)",
              },
            ]}
            height={300}
          />
        </div>
      ),
    },
    {
      id: "data-table",
      type: "table",
      title: "Top Performing Projects",
      subtitle: "KPI overview",
      icon: Calendar,
      colSpan: { default: 12, lg: 8 },
      component: (
        <div className="px-4 py-2 overflow-auto">
          <DataTable />
        </div>
      ),
    },
  ];

  const headerActions = (
    <>
      <div className="hidden sm:flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-500 gap-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
        <Search className="w-4 h-4" />
        <input
          type="text"
          placeholder="Search analytics..."
          className="bg-transparent border-none focus:outline-none text-zinc-900 dark:text-zinc-50 placeholder-zinc-400"
        />
      </div>
      <button className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-primary-hover dark:hover:bg-white transition-all shadow-sm hover:shadow active:scale-95 font-medium text-sm">
        <Plus className="w-4 h-4" />
        <span>Create Report</span>
      </button>
      <button className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-medium text-sm">
        <Download className="w-4 h-4" />
      </button>
    </>
  );

  return (
    <DashboardLayout
      navbarTitle="Reusable Analytics Dashboard"
      navbarActions={[
        { id: "notify", icon: StarIcon, label: "Star", badge: 3 },
      ]}
      navbarUser={{
        name: "Alex Rivera",
        email: "alex@gatherraa.ai",
        initials: "AR",
      }}
    >
      <ReusableDashboard
        title="Welcome back, Alex!"
        description="Here's what's happening in your business right now. All widgets are independently animated and support dynamic injection."
        headerActions={headerActions}
        widgets={widgets}
      />
    </DashboardLayout>
  );
};

export default DashboardPage;
