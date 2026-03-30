import { createContext, useContext } from 'react';
import type { Event } from '../../lib/api/events';

export interface EventDataContextValue {
  event: Event | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export interface EventListContextValue {
  events: Event[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const EventDataContext = createContext<EventDataContextValue | null>(null);
export const EventListContext = createContext<EventListContextValue | null>(null);

export function useEventData(): EventDataContextValue {
  const ctx = useContext(EventDataContext);
  if (!ctx) throw new Error('useEventData must be used within EventDataProvider');
  return ctx;
}

export function useEventList(): EventListContextValue {
  const ctx = useContext(EventListContext);
  if (!ctx) throw new Error('useEventList must be used within EventListProvider');
  return ctx;
}
