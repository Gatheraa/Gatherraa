'use client';

import React from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useNotificationBell } from '@/hooks/useNotificationBell';
import type { Notification } from '@/types/notifications';

/**
 * Example: Integrating NotificationBell in a Header/Navbar
 * 
 * This component demonstrates how to use the NotificationBell with real data
 * and handle notifications in your application.
 */

export default function NotificationBellExample() {
  // Using the custom hook for managing notifications
  const {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    dismissNotification,
    markAllAsRead,
  } = useNotificationBell({
    autoFetch: true, // Automatically fetch on mount and poll periodically
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Example with mock data (for demonstration/testing)
  const mockNotifications: Notification[] = [
    {
      id: '1',
      title: 'Payment Received',
      message: 'You received a payment of $50.00 for ticket sales',
      type: 'success',
      timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
      isRead: false,
    },
    {
      id: '2',
      title: 'Event Starting Soon',
      message: 'Your event "Tech Conference 2026" starts in 2 hours',
      type: 'warning',
      timestamp: new Date(Date.now() - 30 * 60000), // 30 minutes ago
      isRead: false,
    },
    {
      id: '3',
      title: 'New Review',
      message: 'Sarah left a 5-star review on your event',
      type: 'info',
      timestamp: new Date(Date.now() - 2 * 60 * 60000), // 2 hours ago
      isRead: true,
    },
    {
      id: '4',
      title: 'Low Ticket Inventory',
      message: 'Only 10 tickets remaining for "Summer Festival"',
      type: 'error',
      timestamp: new Date(Date.now() - 24 * 60 * 60000), // 1 day ago
      isRead: true,
    },
  ];

  // Use mock data for demo, or real data from the hook
  const displayNotifications = notifications.length > 0 ? notifications : mockNotifications;

  return (
    <div className="p-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">NotificationBell Component</h1>
        
        <p className="text-gray-600">
          Click the bell icon to see notifications. The component supports:
        </p>

        <ul className="list-disc list-inside space-y-2 text-gray-600">
          <li>Bell icon with unread count badge</li>
          <li>Scrollable dropdown list</li>
          <li>Mark individual notifications as read</li>
          <li>Dismiss/delete notifications</li>
          <li>Notification type indicators (color-coded)</li>
          <li>Relative timestamps using date-fns</li>
          <li>Auto-dismissal outside dropdown</li>
        </ul>

        <div className="mt-8 flex items-center gap-4">
          <NotificationBell
            notifications={displayNotifications}
            onMarkAsRead={(id) => {
              console.log('Mark as read:', id);
              markAsRead(id);
            }}
            onDismiss={(id) => {
              console.log('Dismiss notification:', id);
              dismissNotification(id);
            }}
            maxDisplayCount={10}
          />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Status:</p>
            <p className="text-sm text-gray-600">
              {isLoading && 'Loading notifications...'}
              {error && `Error: ${error}`}
              {!isLoading && !error && `${displayNotifications.length} notifications`}
            </p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-2">Integration Instructions:</h2>
          <pre className="text-xs text-blue-800 overflow-x-auto">
{`// In your header/navbar component:
import NotificationBell from '@/components/notifications/NotificationBell';
import { useNotificationBell } from '@/hooks/useNotificationBell';

export default function Header() {
  const { notifications, markAsRead, dismissNotification } = useNotificationBell({
    autoFetch: true,
    pollInterval: 30000,
  });

  return (
    <header className="flex items-center justify-between">
      <h1>My App</h1>
      <NotificationBell
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onDismiss={dismissNotification}
      />
    </header>
  );
}`}
          </pre>
        </div>

        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="font-semibold text-green-900 mb-2">API Endpoints Expected:</h2>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• <code className="bg-white px-2 py-1">GET /api/notifications</code> - Fetch all notifications</li>
            <li>• <code className="bg-white px-2 py-1">PATCH /api/notifications/{'{id}'}/read</code> - Mark as read</li>
            <li>• <code className="bg-white px-2 py-1">DELETE /api/notifications/{'{id}'}</code> - Delete notification</li>
            <li>• <code className="bg-white px-2 py-1">PATCH /api/notifications/read-all</code> - Mark all as read</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
