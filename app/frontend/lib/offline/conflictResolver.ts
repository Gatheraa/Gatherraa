export type { ConflictRecord } from './db';
import { db, ConflictRecord, OfflineEvent } from './db';
import { eventsApi, UpdateEventDto } from '../api/events';
import { enqueueSync } from './syncQueue';

// Conflict resolution strategies
export type ConflictStrategy = 'local' | 'server' | 'merge' | 'manual';

// Result of conflict resolution
export interface ConflictResolution {
  strategy: ConflictStrategy;
  data: OfflineEvent;
  applied: boolean;
}

// Get all unresolved conflicts
export async function getUnresolvedConflicts(): Promise<ConflictRecord[]> {
  return db.conflicts
    .where('resolvedAt')
    .equals(undefined)
    .toArray();
}

// Get conflict by ID
export async function getConflict(conflictId: string): Promise<ConflictRecord | undefined> {
  return db.conflicts.get(conflictId);
}

// Resolve conflict using local version
export async function resolveWithLocal(conflictId: string): Promise<ConflictResolution> {
  const conflict = await getConflict(conflictId);
  if (!conflict) throw new Error('Conflict not found');

  const localEvent = conflict.localData as OfflineEvent;
  
  // Update server with local data
  const updateData: UpdateEventDto = {
    name: localEvent.name,
    description: localEvent.description || undefined,
    startTime: localEvent.startTime,
    endTime: localEvent.endTime || undefined,
  };

  try {
    const updatedEvent = await eventsApi.updateEvent(conflict.entityId, updateData);
    
    // Update local record
    await db.events.update(conflict.localId, {
      ...updatedEvent,
      syncStatus: 'synced',
      version: (localEvent.version || 0) + 1,
    });

    // Mark conflict as resolved
    await markConflictResolved(conflictId, 'local');

    return {
      strategy: 'local',
      data: { ...localEvent, ...updatedEvent, syncStatus: 'synced' },
      applied: true,
    };
  } catch (error) {
    // If update fails, re-queue for sync
    await enqueueSync('event', conflict.entityId, conflict.localId, 'update', {
      id: conflict.entityId,
      data: updateData,
      originalVersion: localEvent.version,
    });

    throw error;
  }
}

// Resolve conflict using server version
export async function resolveWithServer(conflictId: string): Promise<ConflictResolution> {
  const conflict = await getConflict(conflictId);
  if (!conflict) throw new Error('Conflict not found');

  const serverEvent = conflict.serverData as OfflineEvent;
  
  // Update local record with server data
  await db.events.update(conflict.localId, {
    ...serverEvent,
    localId: conflict.localId,
    syncStatus: 'synced',
    version: (serverEvent.version || 0) + 1,
  });

  // Mark conflict as resolved
  await markConflictResolved(conflictId, 'server');

  return {
    strategy: 'server',
    data: { ...serverEvent, localId: conflict.localId, syncStatus: 'synced' },
    applied: true,
  };
}

// Merge local and server changes
export async function resolveWithMerge(
  conflictId: string,
  mergedData: UpdateEventDto
): Promise<ConflictResolution> {
  const conflict = await getConflict(conflictId);
  if (!conflict) throw new Error('Conflict not found');

  const localEvent = conflict.localData as OfflineEvent;

  try {
    // Apply merged data to server
    const updatedEvent = await eventsApi.updateEvent(conflict.entityId, mergedData);
    
    // Update local record
    await db.events.update(conflict.localId, {
      ...updatedEvent,
      syncStatus: 'synced',
      version: (localEvent.version || 0) + 1,
    });

    // Mark conflict as resolved
    await markConflictResolved(conflictId, 'merged');

    return {
      strategy: 'merge',
      data: { ...localEvent, ...updatedEvent, syncStatus: 'synced' },
      applied: true,
    };
  } catch (error) {
    // If update fails, re-queue for sync
    await enqueueSync('event', conflict.entityId, conflict.localId, 'update', {
      id: conflict.entityId,
      data: mergedData,
      originalVersion: localEvent.version,
    });

    throw error;
  }
}

// Mark conflict as resolved
async function markConflictResolved(
  conflictId: string,
  resolution: 'local' | 'server' | 'merged'
): Promise<void> {
  await db.conflicts.update(conflictId, {
    resolvedAt: Date.now(),
    resolution,
  });
}

// Auto-resolve conflicts based on strategy
export async function autoResolveConflicts(strategy: ConflictStrategy): Promise<number> {
  if (strategy === 'manual') return 0;

  const conflicts = await getUnresolvedConflicts();
  let resolved = 0;

  for (const conflict of conflicts) {
    try {
      switch (strategy) {
        case 'local':
          await resolveWithLocal(conflict.id);
          break;
        case 'server':
          await resolveWithServer(conflict.id);
          break;
        default:
          continue;
      }
      resolved++;
    } catch (error) {
      console.error(`Failed to auto-resolve conflict ${conflict.id}:`, error);
    }
  }

  return resolved;
}

// Get conflict statistics
export async function getConflictStats(): Promise<{
  total: number;
  unresolved: number;
  resolved: number;
  byStrategy: Record<string, number>;
}> {
  const allConflicts = await db.conflicts.toArray();
  const unresolved = allConflicts.filter((c: ConflictRecord) => !c.resolvedAt);
  const resolved = allConflicts.filter((c: ConflictRecord) => c.resolvedAt);

  const byStrategy: Record<string, number> = {};
  resolved.forEach((c: ConflictRecord) => {
    const strategy = c.resolution || 'unknown';
    byStrategy[strategy] = (byStrategy[strategy] || 0) + 1;
  });

  return {
    total: allConflicts.length,
    unresolved: unresolved.length,
    resolved: resolved.length,
    byStrategy,
  };
}
