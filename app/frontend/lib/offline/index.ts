// Export database and types
export { db, SyncStatus, OperationType, SyncedEntity, OfflineEvent, SyncQueueItem, ConflictRecord } from './db';
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
export {
  ConflictStrategy,
  ConflictResolution,
  getUnresolvedConflicts,
  getConflict,
  resolveWithLocal,
  resolveWithServer,
  resolveWithMerge,
  autoResolveConflicts,
  getConflictStats,
} from './conflictResolver';

// Export offline context
export {
  OfflineProvider,
  useOffline,
  useEntitySyncStatus,
  NetworkStatus,
  SyncState,
  OfflineContextValue,
} from './OfflineContext';

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
