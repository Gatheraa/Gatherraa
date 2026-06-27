import React, { useCallback } from "react";
import { Announcement } from "./announcement.types";
import {
  PRIORITY_CONFIG,
  CATEGORY_ICON_MAP,
  CATEGORY_LABELS,
  formatAnnouncementTime,
} from "./announcement.utils";

interface AnnouncementCardProps {
  announcement: Announcement;
  onRead: (id: string) => void;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  onRead,
}) => {
  const { id, title, body, category, priority, author, createdAt, updatedAt, isRead, isPinned } =
    announcement;

  const priorityConfig = PRIORITY_CONFIG[priority];
  const categoryIcon = CATEGORY_ICON_MAP[category];
  const categoryLabel = CATEGORY_LABELS[category];
  const timeLabel = formatAnnouncementTime(updatedAt ?? createdAt);

  const handleClick = useCallback(() => {
    if (!isRead) onRead(id);
  }, [id, isRead, onRead]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!isRead) onRead(id);
      }
    },
    [id, isRead, onRead]
  );

  return (
    <article
      role="article"
      aria-label={title}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        "group relative flex gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isRead
          ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
          : "bg-blue-50/50 border-blue-100 hover:border-blue-200 hover:shadow-md shadow-sm",
      ].join(" ")}
    >
      {/* Unread indicator strip */}
      {!isRead && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-blue-500"
        />
      )}

      {/* Category icon */}
      <div
        className={[
          "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg",
          isRead ? "bg-gray-50" : "bg-white shadow-sm",
        ].join(" ")}
        aria-hidden="true"
      >
        {categoryIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isPinned && (
              <span
                title="Pinned announcement"
                className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"
              >
                📌 Pinned
              </span>
            )}
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${priorityConfig.badgeClass}`}
            >
              {priorityConfig.label}
            </span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
              {categoryLabel}
            </span>
          </div>

          <span className="flex-shrink-0 text-xs text-gray-400 tabular-nums" title={createdAt}>
            {timeLabel}
          </span>
        </div>

        <h3
          className={[
            "text-sm font-semibold leading-snug mb-1 pr-1",
            isRead ? "text-gray-700" : "text-gray-900",
          ].join(" ")}
        >
          {title}
        </h3>

        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 whitespace-pre-line">
          {body}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">By {author.name}</span>

          {!isRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead(id);
              }}
              className="text-[11px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
              aria-label="Mark as read"
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </article>
  );
};