'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PointBalance, UsePointBalanceOptions, UsePointBalanceReturn } from '@/types/pointBalance';

/**
 * Custom hook for managing point/token balance
 * Handles fetching, polling, and state management
 */
export function usePointBalance(options: UsePointBalanceOptions = {}): UsePointBalanceReturn {
  const { autoFetch = true, pollInterval = 30000, userId = 'current' } = options;

  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch point balance from API
   */
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/points/balance?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.balance) {
        setBalance({
          ...data.balance,
          lastUpdated: new Date(),
        });
      } else {
        throw new Error(data.message || 'Failed to fetch balance');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching point balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Update balance locally
   */
  const updateBalance = useCallback((newBalance: Partial<PointBalance>) => {
    setBalance((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...newBalance,
        lastUpdated: new Date(),
      };
    });
  }, []);

  /**
   * Auto-fetch on mount and polling
   */
  useEffect(() => {
    if (!autoFetch) return;

    // Fetch immediately
    refresh();

    // Set up polling
    const pollTimer = setInterval(() => {
      refresh();
    }, pollInterval);

    return () => clearInterval(pollTimer);
  }, [autoFetch, pollInterval, refresh]);

  return {
    balance,
    isLoading,
    error,
    refresh,
    updateBalance,
  };
}
