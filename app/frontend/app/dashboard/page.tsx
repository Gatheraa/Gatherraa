'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Clock, ArrowDownToLine } from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';
import { WrongNetworkAlert } from '@/components/wallet/WrongNetworkAlert';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gatherraa</h1>
          <div className="flex items-center gap-3">
            <WalletAddress />
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wrong Network Alert */}
        <div className="mb-6">
          <WrongNetworkAlert />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contributor Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Track your earnings and missions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${totalEarnings}</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${availableBalance}</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Rewards</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${pendingRewards}</p>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <ArrowDownToLine className="w-5 h-5" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('missions')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'missions'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Missions
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                History
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Earnings Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={earningsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Area type="monotone" dataKey="earnings" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Missions</h3>
                    <div className="space-y-3">
                      {activeMissions.slice(0, 3).map((mission) => (
                        <div key={mission.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{mission.title}</h4>
                            <span className="text-green-600 dark:text-green-400 font-semibold">${mission.reward}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${mission.progress}%` }}
                            />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{mission.progress}% complete</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Completions</h3>
                    <div className="space-y-3">
                      {completedMissions.slice(0, 3).map((mission) => (
                        <div key={mission.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">{mission.title}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{mission.completedDate}</p>
                            </div>
                            <span className="text-green-600 dark:text-green-400 font-semibold">${mission.reward}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Missions Tab */}
            {activeTab === 'missions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Missions ({activeMissions.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Mission</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Reward</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Progress</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Deadline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {activeMissions.map((mission) => (
                          <tr key={mission.id}>
                            <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{mission.title}</td>
                            <td className="px-4 py-4 text-sm text-green-600 dark:text-green-400 font-semibold">${mission.reward}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${mission.progress}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{mission.progress}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{mission.deadline}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Completed Missions ({completedMissions.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Mission</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Reward</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Completed</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {completedMissions.map((mission) => (
                          <tr key={mission.id}>
                            <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{mission.title}</td>
                            <td className="px-4 py-4 text-sm text-green-600 dark:text-green-400 font-semibold">${mission.reward}</td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{mission.completedDate}</td>
                            <td className="px-4 py-4 text-sm text-yellow-500">{'⭐'.repeat(mission.rating)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Withdraw History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase">Transaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {withdrawHistory.map((withdrawal) => (
                        <tr key={withdrawal.id}>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{withdrawal.date}</td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-white font-semibold">${withdrawal.amount}</td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              {withdrawal.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-blue-600 dark:text-blue-400 font-mono">{withdrawal.txHash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
