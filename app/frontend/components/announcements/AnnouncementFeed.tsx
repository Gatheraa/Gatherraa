import React, { useEffect, useRef } from "react";
import { useAnnouncements } from "./useAnnouncements";
import { AnnouncementFeedHeader } from "./AnnouncementFeedHeader";
import { AnnouncementCard } from "./AnnouncementCard";
import { AnnouncementFeedEmpty } from "./";

interface AnnouncementFeedProps {
  eventId: string;
  className?: string;
}

const DEFAULT_FILTERS = { category: "all" as const, priority: "all" as const, readStatus: "all" as const };

export const AnnouncementFeed: React.FC<AnnouncementFeedProps> = ({
  eventId,
  className = "",
}) => {
  const {
    filteredAnnouncements,
    unreadCount,
    announcements,
    isLoading,
    error,
    lastFetchedAt,
    filters,
    setFilters,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useAnnouncements(eventId);

  // Mark items visible in viewport as read after a short dwell time
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dwellTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-announcement-id");
          if (!id) return;

          if (entry.isIntersecting) {
            // Mark as read after 2.5s of visibility
            const timer = setTimeout(() => markAsRead(id), 2500);
            dwellTimers.current.set(id, timer);
          } else {
            const timer = dwellTimers.current.get(id);
            if (timer) {
              clearTimeout(timer);
              dwellTimers.current.delete(id);
            }
          }
        });
      },
      { threshold: 0.7 }
    );

    itemRefs.current.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      dwellTimers.current.forEach(clearTimeout);
    };
  }, [filteredAnnouncements, markAsRead]);

  if (isLoading && announcements.length === 0) {
    return (
      <div className={`flex flex-col ${className}`} aria-busy="true">
        <div className="animate-pulse space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
        <span className="text-3xl mb-3" aria-hidden="true">⚠️</span>
        <p className="text-sm font-medium text-gray-700 mb-1">Could not load announcements</p>
        <p className="text-xs text-gray-400 mb-4">{error}</p>
        <button
          onClick={refresh}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Event announcements"
      className={`flex flex-col ${className}`}
    >
      <AnnouncementFeedHeader
        unreadCount={unreadCount}
        totalCount={announcements.length}
        filters={filters}
        onFiltersChange={setFilters}
        onMarkAllRead={markAllAsRead}
        onRefresh={refresh}
        isLoading={isLoading}
        lastFetchedAt={lastFetchedAt}
      />

      <div
        role="feed"
        aria-live="polite"
        aria-label="Announcement list"
        aria-busy={isLoading}
        className="flex-1 overflow-y-auto space-y-2 pt-3 px-1"
      >
        {filteredAnnouncements.length === 0 ? (
          <AnnouncementFeedEmpty
            filters={filters}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              data-announcement-id={announcement.id}
              ref={(el) => {
                if (el) itemRefs.current.set(announcement.id, el);
                else itemRefs.current.delete(announcement.id);
              }}
            >
              <AnnouncementCard
                announcement={announcement}
                onRead={markAsRead}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
};