import { Announcement, AnnouncementCategory, AnnouncementPriority } from "./announcement.types";

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  schedule: "Schedule",
  venue: "Venue",
  speaker: "Speaker",
  ticket: "Ticket",
  general: "General",
  cancellation: "Cancellation",
};

export const PRIORITY_CONFIG: Record<
  AnnouncementPriority,
  { label: string; colorClass: string; badgeClass: string }
> = {
  low: {
    label: "Info",
    colorClass: "text-gray-500",
    badgeClass: "bg-gray-100 text-gray-600",
  },
  medium: {
    label: "Update",
    colorClass: "text-blue-600",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  high: {
    label: "Important",
    colorClass: "text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700",
  },
  critical: {
    label: "Urgent",
    colorClass: "text-red-600",
    badgeClass: "bg-red-50 text-red-700",
  },
};

export const CATEGORY_ICON_MAP: Record<AnnouncementCategory, string> = {
  schedule: "🗓️",
  venue: "📍",
  speaker: "🎤",
  ticket: "🎟️",
  general: "📢",
  cancellation: "❌",
};

export function formatAnnouncementTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function sortAnnouncements(announcements: Announcement[]): Announcement[] {
  const priorityOrder: Record<AnnouncementPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...announcements].sort((a, b) => {
    // Pinned always first
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    // Then by priority
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}