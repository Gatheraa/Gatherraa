'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownToLine, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { Badge, Button, Card, Modal } from '@/components/ui';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';
import { WrongNetworkAlert } from '@/components/wallet/WrongNetworkAlert';

const earningsData = [
  { month: 'Jan', earnings: 1200 },
  { month: 'Feb', earnings: 1900 },
  { month: 'Mar', earnings: 1600 },
  { month: 'Apr', earnings: 2400 },
  { month: 'May', earnings: 2100 },
  { month: 'Jun', earnings: 2800 },
];

const activeMissions = [
  { id: 1, title: 'Bug Fix: Login Issue', reward: 150, progress: 75, deadline: '2024-07-01' },
  { id: 2, title: 'Feature: Dark Mode', reward: 300, progress: 40, deadline: '2024-07-15' },
  { id: 3, title: 'Documentation Update', reward: 100, progress: 90, deadline: '2024-06-25' },
];

function progressWidthClass(progress: number) {
  if (progress >= 90) return 'w-[90%]';
  if (progress >= 75) return 'w-[75%]';
  if (progress >= 50) return 'w-1/2';
  if (progress >= 40) return 'w-[40%]';
  if (progress >= 25) return 'w-1/4';
  return 'w-[10%]';
}

function EarningsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <Card className="p-3 shadow-lg">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm text-primary">${payload[0]?.value?.toLocaleString()}</p>
    </Card>
  );
}

export default function ContributorDashboard() {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const totalEarnings = 12100;
  const availableBalance = 2800;
  const pendingRewards = 550;

  const stats = useMemo(
    () => [
      {
        label: 'Total Earnings',
        value: `$${totalEarnings.toLocaleString()}`,
        icon: DollarSign,
        accent: 'text-primary',
      },
      {
        label: 'Available Balance',
        value: `$${availableBalance.toLocaleString()}`,
        icon: TrendingUp,
        accent: 'text-success',
      },
      {
        label: 'Pending Rewards',
        value: `$${pendingRewards.toLocaleString()}`,
        icon: Clock,
        accent: 'text-warning',
      },
    ],
    [availableBalance, pendingRewards, totalEarnings]
  );

  return (
    <DashboardLayout
      title="Contributor Dashboard"
      subtitle="Track your earnings and mission delivery in one place."
      actions={
        <div className="flex items-center gap-2">
          <WalletAddress />
          <WalletButton />
          <Button
            onClick={() => setShowWithdrawModal(true)}
            aria-label="Open withdraw confirmation"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw
          </Button>
        </div>
      }
    >
      <div className="mb-6">
        <WrongNetworkAlert />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`h-6 w-6 ${stat.accent}`} />
            </div>
          </Card>
        ))}
        <Card className="flex items-center justify-center p-5">
          <p className="text-sm text-muted">Next payout in 3 days</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">Earnings Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fill: 'currentColor' }} />
              <YAxis tick={{ fill: 'currentColor' }} />
              <Tooltip content={<EarningsTooltip />} />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold">Active Missions</h3>
          <div className="space-y-4">
            {activeMissions.map((mission) => (
              <div key={mission.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{mission.title}</p>
                    <p className="text-xs text-muted">Due {mission.deadline}</p>
                  </div>
                  <Badge variant="success">${mission.reward}</Badge>
                </div>
                <div className="h-2 rounded-full bg-surface-muted">
                  <div className={`h-2 rounded-full bg-primary ${progressWidthClass(mission.progress)}`} />
                </div>
                <p className="mt-2 text-xs text-muted">{mission.progress}% complete</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title="Withdraw available balance"
        description="This is a placeholder flow for payout confirmation."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            You are about to withdraw <span className="font-semibold text-foreground">${availableBalance}</span>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowWithdrawModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowWithdrawModal(false)}>Confirm Withdraw</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
