// Export database and types
export { db } from './db';
export type { SyncStatus, OperationType, SyncedEntity, OfflineEvent, SyncQueueItem, ConflictRecord } from './db';
export { generateLocalId, toOfflineEvent, createPendingEvent } from './db';

// Export sync queue
export {
  enqueueSync,
  dequeueSync,
  processSyncItem,
  processAllPending,
  getPendingSyncItems,
  retrySyncItem,
  calculateNextRetry,
} from './syncQueue';

// Export conflict resolver
export type { ConflictStrategy, ConflictResolution } from './conflictResolver';
export {
  getUnresolvedConflicts,
  getConflict,
  resolveWithLocal,
  resolveWithServer,
  resolveWithMerge,
  autoResolveConflicts,
  getConflictStats,
} from './conflictResolver';

// Export offline context
export { OfflineProvider, useOffline, useEntitySyncStatus } from './OfflineContext';
export type { NetworkStatus, SyncState, OfflineContextValue } from './OfflineContext';

// Export offline events API
export {
  getEventsOffline,
  getEventOffline,
  createEventOffline,
  updateEventOffline,
  deleteEventOffline,
  getPendingChangesCount,
  getSyncStats,
  forceSyncEvent,
  clearOfflineData,
} from './eventsOffline';
