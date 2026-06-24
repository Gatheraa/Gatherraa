import React from "react";
import { AnnouncementBadge } from "./AnnouncementBadge";
import { AnnouncementFilters, AnnouncementCategory } from "./announcement.types";

interface AnnouncementFeedHeaderProps {
  unreadCount: number;
  totalCount: number;
  filters: AnnouncementFilters;
  onFiltersChange: (filters: AnnouncementFilters) => void;
  onMarkAllRead: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastFetchedAt: string | null;
}

const CATEGORIES: Array<{ value: AnnouncementCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "schedule", label: "Schedule" },
  { value: "venue", label: "Venue" },
  { value: "speaker", label: "Speaker" },
  { value: "ticket", label: "Ticket" },
  { value: "general", label: "General" },
];

export const AnnouncementFeedHeader: React.FC<AnnouncementFeedHeaderProps> = ({
  unreadCount,
  totalCount,
  filters,
  onFiltersChange,
  onMarkAllRead,
  onRefresh,
  isLoading,
  lastFetchedAt,
}) => {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 pb-3">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">Announcements</h2>
          <AnnouncementBadge count={unreadCount} pulse={unreadCount > 0} />
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Mark all read
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh announcements"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
            title={
              lastFetchedAt
                ? `Last updated ${new Date(lastFetchedAt).toLocaleTimeString()}`
                : "Refresh"
            }
          >
            <svg
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-1"
        role="group"
        aria-label="Filter by category"
      >
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFiltersChange({ ...filters, category: value })}
            aria-pressed={filters.category === value}
            className={[
              "flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150",
              filters.category === value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Read status filter */}
      <div className="flex gap-1 mt-2 px-1" role="group" aria-label="Filter by read status">
        {(["all", "unread", "read"] as const).map((status) => (
          <button
            key={status}
            onClick={() => onFiltersChange({ ...filters, readStatus: status })}
            aria-pressed={filters.readStatus === status}
            className={[
              "text-[11px] capitalize font-medium px-2.5 py-1 rounded-md transition-colors",
              filters.readStatus === status
                ? "bg-blue-50 text-blue-700"
                : "text-gray-400 hover:text-gray-600",
            ].join(" ")}
          >
            {status}
            {status === "unread" && unreadCount > 0 && (
              <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}

        <span className="ml-auto text-[11px] text-gray-300 self-center">
          {totalCount} total
        </span>
      </div>
    </div>
  );
};