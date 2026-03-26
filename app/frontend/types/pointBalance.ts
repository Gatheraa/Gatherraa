/**
 * Point Balance Type Definitions
 */

export interface PointBalance {
  id: string;
  userId: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  pendingBalance: number;
  currency?: string;
  decimals?: number;
  lastUpdated: Date | string;
  percentageChange?: number; // e.g., -5.2 or +10.5
}

export interface PointBalanceResponse {
  success: boolean;
  balance: PointBalance;
  timestamp: string;
  message?: string;
}

export type PointBalanceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PointBalanceProps {
  balance?: number | null; // Can accept just the number for simple use
  fullBalance?: PointBalance; // Full balance object for advanced use
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  showCurrency?: boolean;
  currency?: string;
  decimals?: number;
  variant?: 'compact' | 'detailed'; // compact shows just the balance, detailed shows breakdown
  tooltip?: string;
  className?: string;
}

export interface UsePointBalanceOptions {
  autoFetch?: boolean;
  pollInterval?: number; // milliseconds, default 30000
  userId?: string;
}

export interface UsePointBalanceReturn {
  balance: PointBalance | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateBalance: (newBalance: Partial<PointBalance>) => void;
}

export interface PointBalanceBreakdown {
  total: number;
  available: number;
  locked: number;
  pending: number;
}

export interface PointBalanceTip {
  title: string;
  description: string;
  value: number;
}
