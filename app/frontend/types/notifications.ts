/**
 * Notification types and interfaces
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date | string;
  isRead: boolean;
  icon?: React.ReactNode;
  actionUrl?: string; // Optional URL to navigate to when clicked
}

export interface NotificationBellProps {
  notifications?: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  maxDisplayCount?: number;
}

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string; // ISO datetime string
  isRead: boolean;
}
