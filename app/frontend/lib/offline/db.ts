import Dexie, { Table } from 'dexie';
import { Event } from '../api/events';

// Sync status for tracking operation state
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed' | 'conflict';

// Operation types for sync queue
export type OperationType = 'create' | 'update' | 'delete';

// Base interface for synced entities
export interface SyncedEntity {
  id: string;
  localId: string;
  syncStatus: SyncStatus;
  lastModified: number;
  version: number;
  pendingOperation?: OperationType;
  retryCount: number;
  lastError?: string;
}

// Event with sync metadata
export interface OfflineEvent extends Event, SyncedEntity {}

// Sync queue item
export interface SyncQueueItem {
  id: string;
  entityType: 'event';
  entityId: string;
  localId: string;
  operation: OperationType;
  data: unknown;
  timestamp: number;
  retryCount: number;
  nextRetryAt?: number;
  error?: string;
}

// Conflict record
export interface ConflictRecord {
  id: string;
  entityType: 'event';
  entityId: string;
  localId: string;
  localData: unknown;
  serverData: unknown;
  detectedAt: number;
  resolvedAt?: number;
  resolution?: 'local' | 'server' | 'merged';
}

class OfflineDatabase extends Dexie {
  events!: Table<OfflineEvent, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  conflicts!: Table<ConflictRecord, string>;

  constructor() {
    super('GatherraaOfflineDB');
    
    this.version(1).stores({
      events: 'id, localId, syncStatus, lastModified, version',
      syncQueue: 'id, entityId, operation, timestamp, retryCount',
      conflicts: 'id, entityId, detectedAt, resolvedAt',
    });
  }
}

export const db = new OfflineDatabase();

// Generate local ID for offline-created entities
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert API Event to OfflineEvent
export function toOfflineEvent(event: Event, syncStatus: SyncStatus = 'synced'): OfflineEvent {
  return {
    ...event,
    localId: event.id,
    syncStatus,
    lastModified: Date.now(),
    version: 1,
    retryCount: 0,
  };
}

// Create pending event from draft data
export function createPendingEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): OfflineEvent {
  const localId = generateLocalId();
  const now = new Date().toISOString();
  
  return {
    ...data,
    id: localId,
    localId,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    lastModified: Date.now(),
    version: 1,
    pendingOperation: 'create',
    retryCount: 0,
  };
}
