'use client';

import { ReactNode } from 'react';
import useSWR from 'swr';
import { eventsApi } from '../../lib/api/events';
import { EventDataContext, EventListContext } from './EventDataContext';

// ─── Single Event Provider ────────────────────────────────────────────────────

interface EventDataProviderProps {
  eventId: string;
  children: ReactNode;
}

export function EventDataProvider({ eventId, children }: EventDataProviderProps) {
  const { data, error, isLoading, mutate } = useSWR(
    eventId ? `event:${eventId}` : null,
    () => eventsApi.getEvent(eventId),
    { revalidateOnFocus: false }
  );

  return (
    <EventDataContext.Provider
      value={{
        event: data ?? null,
        isLoading,
        error: error ?? null,
        refresh: () => mutate(),
      }}
    >
      {children}
    </EventDataContext.Provider>
  );
}

// ─── Event List Provider ──────────────────────────────────────────────────────

interface EventListProviderProps {
  page?: number;
  limit?: number;
  children: ReactNode;
}

export function EventListProvider({ page = 1, limit = 20, children }: EventListProviderProps) {
  const { data, error, isLoading, mutate } = useSWR(
    `events:${page}:${limit}`,
    () => eventsApi.getEvents(page, limit),
    { revalidateOnFocus: false }
  );

  return (
    <EventListContext.Provider
      value={{
        events: data?.data ?? [],
        total: data?.total ?? 0,
        isLoading,
        error: error ?? null,
        refresh: () => mutate(),
      }}
    >
      {children}
    </EventListContext.Provider>
  );
}
