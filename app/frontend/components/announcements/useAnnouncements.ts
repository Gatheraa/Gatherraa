import { useState, useEffect, useCallback, useRef } from "react";
import {
  Announcement,
  AnnouncementFeedState,
  AnnouncementFilters,
} from "./announcement.types";
import { MOCK_ANNOUNCEMENTS } from "./announcement.mock";

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const READ_STORAGE_KEY = "gatherraa:read_announcements";

function getReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable — graceful degradation
  }
}

async function fetchAnnouncements(eventId: string): Promise<Announcement[]> {
  // TODO: Replace with real API call
  // const res = await fetch(`/api/events/${eventId}/announcements`);
  // if (!res.ok) throw new Error("Failed to fetch announcements");
  // return res.json();

  // Simulate network latency in dev
  await new Promise((r) => setTimeout(r, 600));
  return MOCK_ANNOUNCEMENTS;
}

export interface UseAnnouncementsReturn extends AnnouncementFeedState {
  filteredAnnouncements: Announcement[];
  filters: AnnouncementFilters;
  setFilters: (filters: AnnouncementFilters) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refresh: () => void;
}

export function useAnnouncements(
  eventId: string,
  options: { enablePolling?: boolean } = {}
): UseAnnouncementsReturn {
  const { enablePolling = true } = options;

  const [state, setState] = useState<AnnouncementFeedState>({
    announcements: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
    lastFetchedAt: null,
  });

  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [filters, setFilters] = useState<AnnouncementFilters>({
    category: "all",
    priority: "all",
    readStatus: "all",
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const applyReadState = useCallback(
    (announcements: Announcement[], ids: Set<string>): Announcement[] =>
      announcements.map((a) => ({ ...a, isRead: ids.has(a.id) })),
    []
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const raw = await fetchAnnouncements(eventId);
        if (!isMountedRef.current) return;

        setReadIds((currentIds) => {
          const hydrated = applyReadState(raw, currentIds);
          const sorted = (hydrated);
          const unreadCount = sorted.filter((a) => !a.isRead).length;

          setState({
            announcements: sorted,
            unreadCount,
            isLoading: false,
            error: null,
            lastFetchedAt: new Date().toISOString(),
          });

          return currentIds;
        });
      } catch (err) {
        if (!isMountedRef.current) return;
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load announcements",
        }));
      }
    },
    [eventId, applyReadState]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enablePolling, load]);

  // SSE / real-time (wire up when backend is ready)
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    // const source = new EventSource(`/api/events/${eventId}/announcements/stream`);
    // source.onmessage = (e) => {
    //   const announcement: Announcement = JSON.parse(e.data);
    //   setState((s) => {
    //     const updated = sortAnnouncements([announcement, ...s.announcements]);
    //     return { ...s, announcements: updated, unreadCount: s.unreadCount + 1 };
    //   });
    // };
    // return () => source.close();
  }, [eventId]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      persistReadIds(next);

      setState((s) => ({
        ...s,
        announcements: s.announcements.map((a) =>
          a.id === id ? { ...a, isRead: true } : a
        ),
        unreadCount: Math.max(0, s.unreadCount - (prev.has(id) ? 0 : 1)),
      }));

      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setState((s) => {
      const next = new Set(s.announcements.map((a) => a.id));
      persistReadIds(next);
      setReadIds(next);
      return {
        ...s,
        announcements: s.announcements.map((a) => ({ ...a, isRead: true })),
        unreadCount: 0,
      };
    });
  }, []);

  const filteredAnnouncements = state.announcements.filter((a) => {
    if (filters.category && filters.category !== "all" && a.category !== filters.category)
      return false;
    if (filters.priority && filters.priority !== "all" && a.priority !== filters.priority)
      return false;
    if (filters.readStatus === "read" && !a.isRead) return false;
    if (filters.readStatus === "unread" && a.isRead) return false;
    return true;
  });

  return {
    ...state,
    filteredAnnouncements,
    filters,
    setFilters,
    markAsRead,
    markAllAsRead,
    refresh: () => load(),
  };
}