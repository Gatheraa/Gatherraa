'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Star, ArrowRight } from 'lucide-react';
import { eventsApi, Event } from '../../lib/api/events';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 12;

  useEffect(() => {
    loadEvents();
  }, [page]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await eventsApi.getEvents(page, limit);
      if (page === 1) {
        setEvents(response.data);
      } else {
        setEvents((prev) => [...prev, ...response.data]);
      }
      setTotal(response.total);
      setHasMore(response.data.length === limit && events.length + response.data.length < response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateRange = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;

    if (endDate && startDate.toDateString() === endDate.toDateString()) {
      // Same day
      return `${formatDate(start)} ${formatTime(start)} - ${formatTime(end!)}`;
    } else if (endDate) {
      // Multi-day
      return `${formatDate(start)} - ${formatDate(end!)}`;
    } else {
      // Single day, no end time
      return formatDate(start);
    }
  };

  const getEventStatus = (startTime: string, endTime: string | null) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;

    if (end && now > end) {
      return { label: 'Ended', color: 'bg-gray-500' };
    } else if (now >= start && (!end || now <= end)) {
      return { label: 'Live', color: 'bg-green-500' };
    } else if (start.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { label: 'Upcoming', color: 'bg-blue-500' };
    } else {
      return { label: 'Scheduled', color: 'bg-gray-400' };
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading events...</div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
          <button
            onClick={loadEvents}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Events</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover upcoming blockchain events, conferences, and workshops
          </p>
        </div>

        {/* Events Count */}
        {total > 0 && (
          <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
            Showing {events.length} of {total} events
          </div>
        )}

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="text-gray-600 dark:text-gray-400">No events found</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const status = getEventStatus(event.startTime, event.endTime);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden group"
                >
                  <div className="p-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${status.color}`}
                      >
                        {status.label}
                      </span>
                      {event.ratingSummary && event.ratingSummary.totalReviews > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {event.ratingSummary.averageRating.toFixed(1)}
                          </span>
                          <span className="text-xs">
                            ({event.ratingSummary.totalReviews})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Event Title */}
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {event.name}
                    </h2>

                    {/* Description */}
                    {event.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Event Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDateRange(event.startTime, event.endTime)}</span>
                      </div>
                      {event.ratingSummary && event.ratingSummary.totalReviews > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>{event.ratingSummary.totalReviews} reviews</span>
                        </div>
                      )}
                    </div>

                    {/* View Details Link */}
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
                      <span>View Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
