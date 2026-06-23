import React from "react";
import { AnnouncementFilters } from "./announcement.types";

interface AnnouncementFeedEmptyProps {
  filters: AnnouncementFilters;
  onClearFilters: () => void;
}

export const AnnouncementFeedEmpty: React.FC<AnnouncementFeedEmptyProps> = ({
  filters,
  onClearFilters,
}) => {
  const hasActiveFilters =
    (filters.category && filters.category !== "all") ||
    (filters.priority && filters.priority !== "all") ||
    (filters.readStatus && filters.readStatus !== "all");

  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <span className="text-3xl mb-3" aria-hidden="true">🔍</span>
        <p className="text-sm font-medium text-gray-700 mb-1">No matching announcements</p>
        <p className="text-xs text-gray-400 mb-4">Try adjusting your filters to see more.</p>
        <button
          onClick={onClearFilters}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <span className="text-3xl mb-3" aria-hidden="true">📭</span>
      <p className="text-sm font-medium text-gray-700 mb-1">No announcements yet</p>
      <p className="text-xs text-gray-400">
        Event updates and important notices will appear here.
      </p>
    </div>
  );
};