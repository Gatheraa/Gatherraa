export type AnnouncementPriority = "low" | "medium" | "high" | "critical";
export type AnnouncementCategory =
  | "schedule"
  | "venue"
  | "speaker"
  | "ticket"
  | "general"
  | "cancellation";

export interface Announcement {
  id: string;
  eventId: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string; // ISO 8601
  updatedAt?: string;
  isRead: boolean;
  isPinned: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: "image" | "document" | "link";
  }>;
}

export interface AnnouncementFeedState {
  announcements: Announcement[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
}

export interface AnnouncementFilters {
  category?: AnnouncementCategory | "all";
  priority?: AnnouncementPriority | "all";
  readStatus?: "all" | "read" | "unread";
}