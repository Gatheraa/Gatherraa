import { useState, useCallback, useEffect } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date | string;
  isRead: boolean;
}

interface UseNotificationBellOptions {
  autoFetch?: boolean;
  pollInterval?: number; // in milliseconds
}

/**
 * Custom hook for managing notification bell state
 * Handles fetching, marking as read, and dismissing notifications
 */
export const useNotificationBell = (options: UseNotificationBellOptions = {}) => {
  const {
    autoFetch = false,
    pollInterval = 30000, // 30 seconds
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            )
          );
        }
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    []
  );

  // Dismiss/delete notification
  const dismissNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        }
      } catch (err) {
        console.error('Error dismissing notification:', err);
      }
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, []);

  // Auto-fetch setup
  useEffect(() => {
    if (!autoFetch) return;

    // Fetch on mount
    fetchNotifications();

    // Set up polling
    const interval = setInterval(fetchNotifications, pollInterval);

    return () => clearInterval(interval);
  }, [autoFetch, fetchNotifications, pollInterval]);

  return {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    dismissNotification,
    markAllAsRead,
  };
};
