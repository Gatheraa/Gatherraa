import { db, OfflineEvent, toOfflineEvent, createPendingEvent } from './db';
import { eventsApi, Event, CreateEventDto, UpdateEventDto } from '../api/events';
import { enqueueSync } from './syncQueue';

// Get all events (from cache or API)
export async function getEventsOffline(page: number = 1, limit: number = 20): Promise<{
  data: OfflineEvent[];
  total: number;
  fromCache: boolean;
}> {
  try {
    // Try to fetch from API first
    const response = await eventsApi.getEvents(page, limit);
    
    // Cache the results
    const offlineEvents = response.data.map(event => toOfflineEvent(event, 'synced'));
    await db.events.bulkPut(offlineEvents);
    
    return {
      data: offlineEvents,
      total: response.total,
      fromCache: false,
    };
  } catch (error) {
    // If offline, return cached data
    const cachedEvents = await db.events
      .where('syncStatus')
      .not.equal('deleted')
      .toArray();
    
    return {
      data: cachedEvents.slice((page - 1) * limit, page * limit),
      total: cachedEvents.length,
      fromCache: true,
    };
  }
}

// Get single event (from cache or API)
export async function getEventOffline(id: string): Promise<OfflineEvent | null> {
  // Check local cache first
  const cachedEvent = await db.events.get(id);
  if (cachedEvent) {
    return cachedEvent;
  }

  try {
    const event = await eventsApi.getEvent(id);
    const offlineEvent = toOfflineEvent(event, 'synced');
    await db.events.put(offlineEvent);
    return offlineEvent;
  } catch {
    return null;
  }
}

// Create event (offline-first)
export async function createEventOffline(data: CreateEventDto): Promise<OfflineEvent> {
  // Create pending event locally
  const pendingEvent = createPendingEvent(data as Omit<Event, 'id' | 'createdAt' | 'updatedAt'>);
  await db.events.add(pendingEvent);
  
  // Add to sync queue
  await enqueueSync('event', pendingEvent.id, pendingEvent.localId, 'create', data);
  
  return pendingEvent;
}

// Update event (offline-first)
export async function updateEventOffline(
  id: string,
  data: UpdateEventDto
): Promise<OfflineEvent | null> {
  const existingEvent = await db.events.get(id);
  if (!existingEvent) {
    // If not in cache, try to fetch first
    try {
      const serverEvent = await eventsApi.getEvent(id);
      const offlineEvent = toOfflineEvent(serverEvent, 'synced');
      await db.events.put(offlineEvent);
    } catch {
      return null;
    }
  }

  const event = await db.events.get(id);
  if (!event) return null;

  // Update local record
  const updatedEvent: OfflineEvent = {
    ...event,
    ...data,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
    pendingOperation: 'update',
    lastModified: Date.now(),
    version: event.version + 1,
  };

  await db.events.put(updatedEvent);

  // Add to sync queue
  await enqueueSync('event', id, event.localId, 'update', {
    id,
    data,
    originalVersion: event.version,
  });

  return updatedEvent;
}

// Delete event (offline-first)
export async function deleteEventOffline(id: string): Promise<boolean> {
  const event = await db.events.get(id);
  if (!event) {
    // Try to delete directly if not cached
    try {
      await eventsApi.deleteEvent(id);
      return true;
    } catch {
      return false;
    }
  }

  // Mark as deleted locally
  await db.events.update(id, {
    syncStatus: 'pending',
    pendingOperation: 'delete',
    lastModified: Date.now(),
  });

  // Add to sync queue
  await enqueueSync('event', id, event.localId, 'delete', { id });

  return true;
}

// Get pending changes count
export async function getPendingChangesCount(): Promise<number> {
  return db.events.where('syncStatus').not.equal('synced').count();
}

// Get sync stats
export async function getSyncStats(): Promise<{
  total: number;
  synced: number;
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
}> {
  const allEvents = await db.events.toArray();
  
  return {
    total: allEvents.length,
    synced: allEvents.filter((e: OfflineEvent) => e.syncStatus === 'synced').length,
    pending: allEvents.filter((e: OfflineEvent) => e.syncStatus === 'pending').length,
    syncing: allEvents.filter((e: OfflineEvent) => e.syncStatus === 'syncing').length,
    failed: allEvents.filter((e: OfflineEvent) => e.syncStatus === 'failed').length,
    conflict: allEvents.filter((e: OfflineEvent) => e.syncStatus === 'conflict').length,
  };
}

// Force sync a specific event
export async function forceSyncEvent(localId: string): Promise<void> {
  const event = await db.events.get(localId);
  if (!event || event.syncStatus === 'synced') return;

  // Reset retry count and trigger sync
  await db.events.update(localId, {
    retryCount: 0,
    lastError: undefined,
  });
}

// Clear all local data (for logout/reset)
export async function clearOfflineData(): Promise<void> {
  await db.events.clear();
  await db.syncQueue.clear();
  await db.conflicts.clear();
}
