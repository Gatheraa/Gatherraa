'use client';

import { useState, Suspense, lazy } from 'react';
import { DollarSign, TrendingUp, Clock, ArrowDownToLine, ChevronRight, Star } from 'lucide-react';
import { TopNavbar } from '@/components/navigation/TopNavbar';
import { BottomNavbar } from '@/components/navigation/BottomNavbar';
import { WrongNetworkAlert } from '@/components/wallet/WrongNetworkAlert';

// Lazy load heavy chart component
const EarningsChart = lazy(() => import('@/components/dashboard/EarningsChart'));

// Mock data
const earningsData = [
  { month: 'Jan', earnings: 1200 },
  { month: 'Feb', earnings: 1900 },
  { month: 'Mar', earnings: 1600 },
  { month: 'Apr', earnings: 2400 },
  { month: 'May', earnings: 2100 },
  { month: 'Jun', earnings: 2800 },
];

const withdrawHistory = [
  { id: 1, date: '2024-06-15', amount: 500, status: 'Completed', txHash: '0x1234...5678' },
  { id: 2, date: '2024-05-20', amount: 750, status: 'Completed', txHash: '0xabcd...efgh' },
  { id: 3, date: '2024-04-10', amount: 300, status: 'Completed', txHash: '0x9876...5432' },
  { id: 4, date: '2024-03-05', amount: 600, status: 'Completed', txHash: '0xijkl...mnop' },
];

const activeMissions = [
  { id: 1, title: 'Bug Fix: Login Issue', reward: 150, progress: 75, deadline: '2024-07-01' },
  { id: 2, title: 'Feature: Dark Mode', reward: 300, progress: 40, deadline: '2024-07-15' },
  { id: 3, title: 'Documentation Update', reward: 100, progress: 90, deadline: '2024-06-25' },
];

const completedMissions = [
  { id: 1, title: 'API Integration', reward: 500, completedDate: '2024-06-10', rating: 5 },
  { id: 2, title: 'UI Redesign', reward: 800, completedDate: '2024-05-28', rating: 5 },
  { id: 3, title: 'Performance Optimization', reward: 400, completedDate: '2024-05-15', rating: 4 },
  { id: 4, title: 'Security Audit', reward: 600, completedDate: '2024-04-30', rating: 5 },
];

export default function ContributorDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'history'>('overview');

  const totalEarnings = 12100;
  const availableBalance = 2800;
  const pendingRewards = 550;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-0">
      <TopNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 transition-all">
        {/* Wrong Network Alert */}
        <div className="mb-6">
          <WrongNetworkAlert />
        </div>

        {/* Welcome Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, Contributor
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with your earnings today.</p>
          </div>
          <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all">
            <ArrowDownToLine className="w-5 h-5" />
            <span>Withdraw Funds</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          <StatCard
            title="Total Earnings"
            value={`$${totalEarnings.toLocaleString()}`}
            icon={DollarSign}
            color="blue"
            trend="+12% from last month"
          />
          <StatCard
            title="Available Balance"
            value={`$${availableBalance.toLocaleString()}`}
            icon={TrendingUp}
            color="green"
            trend="Ready for withdrawal"
          />
          <StatCard
            title="Pending Rewards"
            value={`$${pendingRewards.toLocaleString()}`}
            icon={Clock}
            color="amber"
            trend="3 missions in review"
          />
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content (Left/Center) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex bg-white dark:bg-gray-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              {(['overview', 'missions', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-sm font-semibold capitalize rounded-xl transition-all ${activeTab === tab
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Panels */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Chart Segment - Lazy Loaded */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Earnings Trajectory</h3>
                  <Suspense fallback={
                    <div className="h-[300px] w-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  }>
                    <EarningsChart data={earningsData} />
                  </Suspense>
                </div>

                {/* Mobile Mission List (Stacked) */}
                <div className="block lg:hidden space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white px-2">Current Focus</h3>
                  <div className="space-y-4">
                    {activeMissions.map((mission) => (
                      <MissionCard key={mission.id} mission={mission} />
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h3>
                    <button className="text-sm font-bold text-blue-600 hover:text-blue-700">View All</button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {completedMissions.slice(0, 4).map((mission) => (
                      <div key={mission.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                            <Star className="w-5 h-5 fill-current" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">{mission.title}</h4>
                            <p className="text-xs text-gray-500">Completed on {mission.completedDate}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">+${mission.reward}</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < mission.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'missions' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Assignments</h3>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {activeMissions.map((mission) => (
                      <div key={mission.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 dark:text-white">{mission.title}</h4>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                              Deadline: {mission.deadline}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">${mission.reward}</span>
                            <div className="w-24 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full" style={{ width: `${mission.progress}%` }} />
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transaction Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Transaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-sm">
                      {withdrawHistory.map((withdrawal) => (
                        <tr key={withdrawal.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {withdrawal.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900 dark:text-white">${withdrawal.amount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">{withdrawal.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-blue-500">{withdrawal.txHash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar (Right) - Visible on desktop */}
          <div className="hidden lg:block space-y-8">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">In Progress</h3>
              <div className="space-y-6">
                {activeMissions.map((mission) => (
                  <div key={mission.id} className="space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{mission.title}</h4>
                      <span className="text-sm font-bold text-blue-600">${mission.reward}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <span>Progress</span>
                        <span>{mission.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden p-0.5">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-1000"
                          style={{ width: `${mission.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl shadow-xl shadow-blue-500/20 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <Star className="w-8 h-8 mb-4 text-blue-200" />
                <h4 className="text-xl font-bold mb-2">Join more missions</h4>
                <p className="text-blue-100 text-sm mb-6 opacity-80">Boost your ranking and earn more by exploring available mission boards.</p>
                <button className="bg-white text-blue-600 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">
                  Browse Boards
                </button>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            </div>
          </div>
        </div>
      </main>

      <BottomNavbar />
    </div>
  );
}

// Sub-components
function StatCard({ title, value, icon: Icon, color, trend }: {
  title: string,
  value: string,
  icon: any,
  color: 'blue' | 'green' | 'amber',
  trend: string
}) {
  const colorStyles = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-blue-500/5',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30 shadow-green-500/5',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30 shadow-amber-500/5',
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm transition-all hover:scale-[1.02] active:scale-95 cursor-pointer bg-white dark:bg-gray-900`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white leading-tight">{value}</p>
          <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
            {trend}
          </p>
        </div>
        <div className={`p-3 rounded-2xl ${colorStyles[color].split(' ')[0]}`}>
          <Icon className={`w-6 h-6 ${colorStyles[color].split(' ')[2]}`} />
        </div>
      </div>
    </div>
  );
}

function MissionCard({ mission }: { mission: any }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white">{mission.title}</h4>
          <span className="text-xs text-gray-400">Ends {mission.deadline}</span>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-lg">
          <span className="text-sm font-bold text-green-600 dark:text-green-400">${mission.reward}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Completion</span>
          <span>{mission.progress}%</span>
        </div>
        <div className="w-full bg-gray-50 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full"
            style={{ width: `${mission.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
