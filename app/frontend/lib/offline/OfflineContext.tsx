'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { db, OfflineEvent, SyncStatus } from './db';
import { processAllPending, getPendingSyncItems } from './syncQueue';
import { getUnresolvedConflicts, type ConflictRecord } from './conflictResolver';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SyncState as SyncStateType } from './OfflineContext';

// Network status type
export type NetworkStatus = 'online' | 'offline' | 'unknown';

// Sync state
export interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  pendingCount: number;
  lastSyncAt: number | null;
  error: string | null;
}

// Offline context value
export interface OfflineContextValue {
  // Network status
  isOnline: boolean;
  networkStatus: NetworkStatus;
  
  // Sync state
  syncState: SyncState;
  
  // Data
  pendingEvents: OfflineEvent[];
  eventsWithConflicts: OfflineEvent[];
  unresolvedConflicts: ConflictRecord[];
  
  // Actions
  triggerSync: () => Promise<void>;
  refreshSyncState: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

// Sync interval (30 seconds)
const SYNC_INTERVAL = 30000;

export function OfflineProvider({ children }: { children: ReactNode }) {
  // Network status
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('unknown');
  
  // Sync state
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });

  // Live queries for reactive data
  const pendingEvents = useLiveQuery(
    () => db.events.where('syncStatus').notEqual('synced').toArray(),
    []
  ) || [];

  const eventsWithConflicts = useLiveQuery(
    () => db.events.where('syncStatus').equals('conflict').toArray(),
    []
  ) || [];

  const unresolvedConflicts = useLiveQuery(
    () => getUnresolvedConflicts(),
    []
  ) || [];

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkStatus('online');
      // Trigger sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkStatus('offline');
    };

    // Initial check
    setIsOnline(navigator.onLine);
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh sync state
  const refreshSyncState = useCallback(async () => {
    try {
      const pendingItems = await getPendingSyncItems();
      setSyncState((prev: SyncStateType) => ({
        ...prev,
        pendingCount: pendingItems.length,
      }));
    } catch (error) {
      console.error('Failed to refresh sync state:', error);
    }
  }, []);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (!isOnline || syncState.status === 'syncing') return;

    setSyncState((prev: SyncStateType) => ({ ...prev, status: 'syncing', error: null }));

    try {
      await processAllPending();
      setSyncState({
        status: 'idle',
        pendingCount: 0,
        lastSyncAt: Date.now(),
        error: null,
      });
    } catch (error) {
      setSyncState((prev: SyncStateType) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, [isOnline, syncState.status]);

  // Auto-sync interval
  useEffect(() => {
    if (!isOnline) return;

    const intervalId = setInterval(() => {
      triggerSync();
    }, SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isOnline, triggerSync]);

  // Initial sync state load
  useEffect(() => {
    refreshSyncState();
  }, [refreshSyncState]);

  const value: OfflineContextValue = {
    isOnline,
    networkStatus,
    syncState,
    pendingEvents,
    eventsWithConflicts,
    unresolvedConflicts,
    triggerSync,
    refreshSyncState,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

// Hook to use offline context
export function useOffline(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

// Hook to get sync status for a specific entity
export function useEntitySyncStatus(localId: string): SyncStatus | undefined {
  const event = useLiveQuery(
    () => db.events.get(localId),
    [localId]
  );
  return event?.syncStatus;
}
