'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, X } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date | string;
  isRead: boolean;
  icon?: React.ReactNode;
}

interface NotificationBellProps {
  notifications?: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  maxDisplayCount?: number;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications = [],
  onMarkAsRead = undefined,
  onDismiss = undefined,
  maxDisplayCount = 10,
}: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayNotifications = notifications.slice(0, maxDisplayCount);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAsRead = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsRead?.(notificationId);
  };

  const handleDismiss = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(notificationId);
  };

  const getTypeStyles = (type: string) => {
    const baseStyles = 'flex items-center gap-2 px-3 py-2 rounded-lg border';
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-200`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-200`;
      case 'info':
      default:
        return `${baseStyles} bg-blue-50 border-blue-200`;
    }
  };

  const getTypeIndicatorColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
      default:
        return 'bg-blue-500';
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={24} className="text-gray-700" />
        
        {/* Badge with unread count */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Bell size={32} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {displayNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors duration-150 ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Type Indicator */}
                      <div
                        className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${getTypeIndicatorColor(
                          notification.type
                        )}`}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium truncate ${
                                !notification.isRead
                                  ? 'text-gray-900 font-semibold'
                                  : 'text-gray-700'
                              }`}
                            >
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 leading-relaxed break-words">
                              {notification.message}
                            </p>
                          </div>

                          {/* Dismiss Button */}
                          <button
                            onClick={(e) => handleDismiss(notification.id, e)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Dismiss notification"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Footer with Timestamp and Action */}
                        <div className="mt-2 flex items-center justify-between">
                          <time className="text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </time>

                          {!notification.isRead && (
                            <button
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {displayNotifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full py-1 rounded hover:bg-blue-100 transition-colors">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
