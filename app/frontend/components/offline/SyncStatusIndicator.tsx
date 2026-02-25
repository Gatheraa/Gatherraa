'use client';

import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useOffline } from '@/lib/offline/OfflineContext';
import { SyncStatus } from '@/lib/offline/db';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  compact?: boolean;
}

export function SyncStatusIndicator({ showDetails = true, compact = false }: SyncStatusIndicatorProps) {
  const { isOnline, networkStatus, syncState, triggerSync, pendingEvents } = useOffline();

  const pendingCount = pendingEvents.length;
  const isSyncing = syncState.status === 'syncing';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        {!isOnline && <WifiOff className="w-4 h-4 text-red-500" />}
        {isOnline && pendingCount > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Network Status */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500" />
        )}
        <span className={`text-sm font-medium ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

      {/* Sync Status */}
      <div className="flex items-center gap-2">
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600 dark:text-blue-400">Syncing...</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {pendingCount} pending
            </span>
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">Synced</span>
          </>
        )}
      </div>

      {/* Sync Button */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={triggerSync}
          className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
        >
          Sync Now
        </button>
      )}

      {/* Error Indicator */}
      {syncState.error && (
        <div className="flex items-center gap-1 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs">Error</span>
        </div>
      )}

      {/* Last Sync Time */}
      {showDetails && syncState.lastSyncAt && (
        <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          Last sync: {formatTime(syncState.lastSyncAt)}
        </div>
      )}
    </div>
  );
}

// Status dot for compact view
function StatusDot({ isOnline, isSyncing, pendingCount }: { isOnline: boolean; isSyncing: boolean; pendingCount: number }) {
  let colorClass = 'bg-green-500';
  
  if (!isOnline) {
    colorClass = 'bg-red-500';
  } else if (isSyncing) {
    colorClass = 'bg-blue-500 animate-pulse';
  } else if (pendingCount > 0) {
    colorClass = 'bg-amber-500';
  }

  return (
    <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
  );
}

// Entity sync status badge
interface EntitySyncBadgeProps {
  status: SyncStatus;
  showLabel?: boolean;
}

export function EntitySyncBadge({ status, showLabel = true }: EntitySyncBadgeProps) {
  const config = {
    synced: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Synced' },
    pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Pending' },
    syncing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Syncing' },
    failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Failed' },
    conflict: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Conflict' },
  };

  const { icon: Icon, color, bg, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${bg} ${color}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {showLabel && label}
    </span>
  );
}

// Conflict alert banner
export function ConflictAlert() {
  const { unresolvedConflicts, eventsWithConflicts } = useOffline();

  if (unresolvedConflicts.length === 0) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
            Sync Conflicts Detected
          </h4>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
            {unresolvedConflicts.length} conflict{unresolvedConflicts.length > 1 ? 's' : ''} need{unresolvedConflicts.length === 1 ? 's' : ''} resolution.
            {eventsWithConflicts.length} event{eventsWithConflicts.length > 1 ? 's' : ''} affected.
          </p>
          <button className="mt-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline">
            Resolve Conflicts →
          </button>
        </div>
      </div>
    </div>
  );
}

// Offline notification banner
export function OfflineBanner() {
  const { isOnline, pendingEvents } = useOffline();

  if (isOnline) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-3">
        <WifiOff className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
            You're offline
          </h4>
          <p className="text-sm text-red-700 dark:text-red-300">
            Changes will be saved locally and synced when you reconnect.
            {pendingEvents.length > 0 && (
              <span className="font-medium"> {pendingEvents.length} change{pendingEvents.length > 1 ? 's' : ''} pending.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// Format time helper
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}
