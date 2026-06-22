"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Megaphone, Check, X, Filter, Volume2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  createdAt: string;
  read: boolean;
  eventId?: string;
}

interface AnnouncementCenterProps {
  eventId?: string;
  limit?: number;
}

const priorityConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  urgent: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <Volume2 className="w-3 h-3" />,
    label: "Urgent",
  },
  high: {
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <Bell className="w-3 h-3" />,
    label: "High",
  },
  medium: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Megaphone className="w-3 h-3" />,
    label: "Medium",
  },
  low: {
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Megaphone className="w-3 h-3" />,
    label: "Low",
  },
};

const AnnouncementCenter: React.FC<AnnouncementCenterProps> = ({
  eventId,
  limit = 50,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (eventId) params.set("eventId", eventId);
      const response = await fetch(
        `/api/announcements?${params.toString()}`
      );
      const data = await response.json();
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId, limit]);

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/announcements/${id}/read`, { method: "POST" });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, read: true } : a))
      );
    } catch (error) {
      console.error("Failed to mark announcement as read:", error);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`/api/announcements/read-all`, { method: "POST" });
      setAnnouncements((prev) => prev.map((a) => ({ ...a, read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const dismissAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const unreadCount = announcements.filter((a) => !a.read).length;

  const filteredAnnouncements = announcements.filter((a) => {
    if (showUnreadOnly && a.read) return false;
    if (filter === "all") return true;
    if (filter === "unread") return !a.read;
    return a.priority === filter;
  });

  const categories = Array.from(
    new Set(announcements.map((a) => a.category).filter(Boolean))
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Announcements</h2>
          {unreadCount > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
          <Button
            variant={showUnreadOnly ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Unread
          </Button>
        </div>
      </div>

      {/* Priority Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "all" ? "primary" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "unread" ? "primary" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          Unread
        </Button>
        {(["urgent", "high", "medium", "low"] as const).map((priority) => {
          const config = priorityConfig[priority];
          return (
            <Button
              key={priority}
              variant={filter === priority ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilter(priority)}
            >
              {config.icon}
              <span className="ml-1">{config.label}</span>
            </Button>
          );
        })}
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={filter === cat ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAnnouncements.map((announcement) => {
            const pConfig = priorityConfig[announcement.priority];
            return (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`relative ${
                    !announcement.read
                      ? "border-l-4 border-l-blue-500 bg-blue-50/30"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!announcement.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <CardTitle
                            className={`text-base ${
                              !announcement.read ? "font-semibold" : ""
                            }`}
                          >
                            {announcement.title}
                          </CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={pConfig.color}>
                            {pConfig.icon}
                            <span className="ml-1">{pConfig.label}</span>
                          </Badge>
                          {announcement.category && (
                            <Badge variant="outline">{announcement.category}</Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTime(announcement.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!announcement.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(announcement.id)}
                            className="h-7 w-7 p-0"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissAnnouncement(announcement.id)}
                          className="h-7 w-7 p-0"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-700">{announcement.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredAnnouncements.length === 0 && (
        <div className="text-center py-12">
          <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {showUnreadOnly ? "All caught up!" : "No announcements"}
          </h3>
          <p className="text-gray-600">
            {showUnreadOnly
              ? "You have no unread announcements."
              : "Check back later for updates."}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnouncementCenter;
