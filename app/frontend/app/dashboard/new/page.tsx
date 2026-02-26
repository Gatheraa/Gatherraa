'use client';

import { useState, useCallback } from 'react';
import {
  DashboardLayout,
  AnalyticsCardGrid,
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
  AreaChartComponent,
  type AnalyticsCardData,
} from '@/components/dashboard';
import { DollarSign, Users, ShoppingCart, TrendingUp, Bell, Search } from 'lucide-react';

// Sample analytics cards data
const analyticsCards: AnalyticsCardData[] = [
  {
    id: 'transactions',
    title: 'Total Transactions',
    value: 15678,
    prefix: '$',
    change: 12.5,
    changeLabel: 'vs last month',
    icon: DollarSign,
    color: 'primary',
  },
  {
    id: 'users',
    title: 'Active Users',
    value: 8432,
    change: 8.2,
    changeLabel: 'vs last month',
    icon: Users,
    color: 'success',
  },
  {
    id: 'sales',
    title: 'Total Sales',
    value: 2456,
    prefix: '',
    suffix: ' units',
    change: -2.4,
    changeLabel: 'vs last month',
    icon: ShoppingCart,
    color: 'warning',
  },
  {
    id: 'revenue',
    title: 'Revenue Growth',
    value: 45678,
    prefix: '$',
    change: 15.8,
    changeLabel: 'vs last month',
    icon: TrendingUp,
    color: 'info',
  },
];

// Sample chart data
const barChartData = [
  { month: 'Jan', revenue: 4000, expenses: 2400 },
  { month: 'Feb', revenue: 3000, expenses: 1398 },
  { month: 'Mar', revenue: 2000, expenses: 9800 },
  { month: 'Apr', revenue: 2780, expenses: 3908 },
  { month: 'May', revenue: 1890, expenses: 4800 },
  { month: 'Jun', revenue: 2390, expenses: 3800 },
];

const lineChartData = [
  { date: 'Jan', visitors: 1200 },
  { date: 'Feb', visitors: 1900 },
  { date: 'Mar', visitors: 1500 },
  { date: 'Apr', visitors: 2100 },
  { date: 'May', visitors: 1800 },
  { date: 'Jun', visitors: 2400 },
];

const pieChartData = [
  { name: 'Desktop', value: 65 },
  { name: 'Mobile', value: 25 },
  { name: 'Tablet', value: 10 },
];

const areaChartData = [
  { week: 'W1', sales: 1200 },
  { week: 'W2', sales: 1900 },
  { week: 'W3', sales: 1500 },
  { week: 'W4', sales: 2100 },
  { week: 'W5', sales: 1800 },
  { week: 'W6', sales: 2400 },
];

export default function NewDashboardPage() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const handleItemClick = useCallback((itemId: string) => {
    console.log('Clicked item:', itemId);
    setActiveItem(itemId);
  }, []);

  const handleCardClick = useCallback((card: AnalyticsCardData) => {
    console.log('Clicked card:', card);
  }, []);

  const handleUserAction = useCallback((action: string) => {
    console.log('User action:', action);
  }, []);

  const navbarActions = [
    {
      id: 'search',
      icon: Search,
      label: 'Search',
      onClick: () => console.log('Search clicked'),
    },
    {
      id: 'notifications',
      icon: Bell,
      label: 'Notifications',
      onClick: () => console.log('Notifications clicked'),
      badge: 3,
    },
  ];

  const navbarUser = {
    name: 'John Doe',
    email: 'john@example.com',
    initials: 'JD',
  };

  return (
    <DashboardLayout
      navbarTitle="Analytics Dashboard"
      navbarActions={navbarActions}
      navbarUser={navbarUser}
      onUserMenuClick={handleUserAction}
      defaultSidebarExpanded={true}
      sidebarProps={{
        activeItemId: activeItem,
        onItemClick: handleItemClick,
      }}
    >
      {/* Analytics Cards Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Overview</h2>
        <AnalyticsCardGrid
          cards={analyticsCards}
          columns={4}
          animateOnLoad={true}
          animationDuration={1500}
          hoverEffect={true}
          onCardClick={handleCardClick}
        />
      </section>

      {/* Charts Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Revenue Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BarChartComponent
            title="Monthly Revenue"
            description="Revenue and expenses comparison"
            data={barChartData}
            series={[
              { dataKey: 'revenue', name: 'Revenue', color: '#2563eb' },
              { dataKey: 'expenses', name: 'Expenses', color: '#dc2626' },
            ]}
            xAxisKey="month"
            height={300}
            showGrid={true}
            showLegend={true}
            animateOnLoad={true}
          />
          <LineChartComponent
            title="Visitor Trends"
            description="Monthly visitor statistics"
            data={lineChartData}
            series={[{ dataKey: 'visitors', name: 'Visitors', color: '#16a34a' }]}
            xAxisKey="date"
            height={300}
            showGrid={true}
            animateOnLoad={true}
          />
        </div>
      </section>

      {/* Additional Charts */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Traffic & Sales</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AreaChartComponent
            title="Weekly Sales"
            description="Sales performance over time"
            data={areaChartData}
            series={[{ dataKey: 'sales', name: 'Sales', color: '#8b5cf6' }]}
            xAxisKey="week"
            height={300}
            showGrid={true}
            animateOnLoad={true}
          />
          <PieChartComponent
            title="Traffic Sources"
            description="Device distribution"
            data={pieChartData}
            xAxisKey="name"
            height={300}
            innerRadius={60}
            outerRadius={100}
            showLegend={true}
            animateOnLoad={true}
          />
        </div>
      </section>

      {/* Summary Section */}
      <section>
        <h2 className="text-xl font-semibold text-text-primary mb-4">Summary</h2>
        <div className="bg-surface rounded-xl border border-border-default p-6">
          <p className="text-text-secondary">
            This dashboard demonstrates the new collapsible sidebar with smooth animations,
            active state highlighting, and keyboard accessibility. The analytics cards feature
            animated counters that animate on load. The charts support multiple types with
            smooth transitions and responsive design.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
