import { db, SyncQueueItem, OperationType, OfflineEvent, ConflictRecord } from './db';
import { eventsApi, Event, CreateEventDto, UpdateEventDto } from '../api/events';

// Exponential backoff configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

// Calculate next retry time with exponential backoff
export function calculateNextRetry(retryCount: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
    RETRY_CONFIG.maxDelay
  );
  return Date.now() + delay;
}

// Add item to sync queue
export async function enqueueSync(
  entityType: 'event',
  entityId: string,
  localId: string,
  operation: OperationType,
  data: unknown
): Promise<void> {
  const queueItem: SyncQueueItem = {
    id: `${entityType}_${localId}_${operation}_${Date.now()}`,
    entityType,
    entityId,
    localId,
    operation,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  await db.syncQueue.add(queueItem);
  
  // Update entity status
  await db.events.update(localId, {
    syncStatus: 'pending',
    pendingOperation: operation,
    lastModified: Date.now(),
  });
}

// Remove item from sync queue
export async function dequeueSync(queueItemId: string): Promise<void> {
  await db.syncQueue.delete(queueItemId);
}

// Process a single sync queue item
export async function processSyncItem(item: SyncQueueItem): Promise<void> {
  try {
    // Mark as syncing
    await db.events.update(item.localId, { syncStatus: 'syncing' });

    switch (item.operation) {
      case 'create':
        await processCreate(item);
        break;
      case 'update':
        await processUpdate(item);
        break;
      case 'delete':
        await processDelete(item);
        break;
    }

    // Success - remove from queue
    await dequeueSync(item.id);
    await db.events.update(item.localId, {
      syncStatus: 'synced',
      pendingOperation: undefined,
      retryCount: 0,
      lastError: undefined,
    });
  } catch (error) {
    await handleSyncError(item, error);
  }
}

// Process create operation
async function processCreate(item: SyncQueueItem): Promise<void> {
  const data = item.data as CreateEventDto;
  const createdEvent = await eventsApi.createEvent(data);
  
  // Update local record with server ID
  const { id, ...eventData } = createdEvent;
  await db.events.update(item.localId, {
    id,
    localId: id,
    ...eventData,
    syncStatus: 'synced',
  });
}

// Process update operation
async function processUpdate(item: SyncQueueItem): Promise<void> {
  const { id, data, originalVersion } = item.data as { 
    id: string; 
    data: UpdateEventDto;
    originalVersion: number;
  };
  
  try {
    const updatedEvent = await eventsApi.updateEvent(id, data);
    
    await db.events.update(item.localId, {
      ...updatedEvent,
      syncStatus: 'synced',
      version: originalVersion + 1,
    });
  } catch (error) {
    // Check for conflict (409) or version mismatch
    if (error instanceof Error && error.message.includes('409')) {
      await handleConflict(item, error);
      return;
    }
    throw error;
  }
}

// Process delete operation
async function processDelete(item: SyncQueueItem): Promise<void> {
  const { id } = item.data as { id: string };
  await eventsApi.deleteEvent(id);
  await db.events.delete(item.localId);
}

// Handle sync error with retry logic
async function handleSyncError(item: SyncQueueItem, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const newRetryCount = item.retryCount + 1;

  if (newRetryCount >= RETRY_CONFIG.maxRetries) {
    // Max retries reached - mark as failed
    await db.syncQueue.update(item.id, {
      retryCount: newRetryCount,
      error: errorMessage,
    });
    await db.events.update(item.localId, {
      syncStatus: 'failed',
      lastError: errorMessage,
      retryCount: newRetryCount,
    });
  } else {
    // Schedule retry
    const nextRetryAt = calculateNextRetry(newRetryCount);
    await db.syncQueue.update(item.id, {
      retryCount: newRetryCount,
      nextRetryAt,
      error: errorMessage,
    });
    await db.events.update(item.localId, {
      syncStatus: 'pending',
      lastError: errorMessage,
      retryCount: newRetryCount,
    });
  }
}

// Handle conflict detection
async function handleConflict(item: SyncQueueItem, error: Error): Promise<void> {
  const localEvent = await db.events.get(item.localId);
  if (!localEvent) return;

  // Fetch server version
  try {
    const serverEvent = await eventsApi.getEvent(item.entityId);
    
    // Create conflict record
    const conflict: ConflictRecord = {
      id: `conflict_${item.entityId}_${Date.now()}`,
      entityType: 'event',
      entityId: item.entityId,
      localId: item.localId,
      localData: localEvent,
      serverData: serverEvent,
      detectedAt: Date.now(),
    };

    await db.conflicts.add(conflict);
    await db.events.update(item.localId, { syncStatus: 'conflict' });
    
    // Remove from queue - requires manual resolution
    await dequeueSync(item.id);
  } catch {
    // If we can't fetch server version, treat as retryable error
    await handleSyncError(item, error);
  }
}

// Get all pending sync items
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue
    .where('retryCount')
    .below(RETRY_CONFIG.maxRetries)
    .and((item: SyncQueueItem) => !item.nextRetryAt || item.nextRetryAt <= Date.now())
    .sortBy('timestamp');
}

// Retry a failed item
export async function retrySyncItem(queueItemId: string): Promise<void> {
  const item = await db.syncQueue.get(queueItemId);
  if (!item) return;

  await db.syncQueue.update(queueItemId, {
    retryCount: 0,
    nextRetryAt: undefined,
    error: undefined,
  });

  await db.events.update(item.localId, {
    syncStatus: 'pending',
    retryCount: 0,
    lastError: undefined,
  });

  await processSyncItem(item);
}

// Process all pending items
export async function processAllPending(): Promise<void> {
  const items = await getPendingSyncItems();
  
  for (const item of items) {
    await processSyncItem(item);
  }
}
