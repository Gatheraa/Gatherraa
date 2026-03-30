'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { eventsApi, Event } from '../../../lib/api/events';
import { ScrollHeader } from '@/components/layout/ScrollHeader';
import { EventAccessGate } from '@/components/ui/molecules';
import RatingDisplay from '../../../components/reviews/rating-display';
import ReviewList from '../../../components/reviews/review-list';
import ReviewForm from '../../../components/reviews/review-form';
import { useAuth } from '../../../hooks/useAuth';

/** API may include aggregates not yet on the base `Event` type */
type EventDetailPayload = Event & {
  ratingSummary?: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  };
};

export default function EventDetailPage() {
  const params = useParams();
  const eventId = typeof params?.id === 'string' ? params.id : '';

  const [event, setEvent] = useState<EventDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isAuthenticated, address } = useAuth();

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        const eventData = (await eventsApi.getEvent(eventId)) as EventDetailPayload;
        setEvent(eventData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const handleReviewSubmit = () => {
    setShowReviewForm(false);
    setRefreshKey((prev) => prev + 1);
    // Reload event to get updated rating
    if (eventId) {
      eventsApi.getEvent(eventId).then(setEvent).catch(console.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            {error || 'Event not found'}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const normalizedAddress = address?.toLowerCase();
  const normalizedOrganizer = event.organizerId?.toLowerCase();

  const isOrganizer = Boolean(normalizedAddress && normalizedOrganizer && normalizedAddress === normalizedOrganizer);
  const isRegistered = Boolean((event as Event & { isRegistered?: boolean }).isRegistered);

  const viewerStatus = {
    isAuthenticated,
    isRegistered,
    isOrganizer,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ScrollHeader threshold={20}>
        {({ compact }) => (
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link
              href="/events"
              className="inline-flex shrink-0 items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className={compact ? 'hidden sm:inline' : ''}>Back to Events</span>
            </Link>
            <p
              className={`min-w-0 truncate font-semibold text-gray-900 transition-all duration-300 dark:text-white motion-reduce:transition-none ${
                compact
                  ? 'max-w-[min(72vw,28rem)] text-base opacity-100'
                  : 'max-w-0 overflow-hidden text-base opacity-0'
              }`}
              aria-hidden={!compact}
            >
              {event.title}
            </p>
          </div>
        )}
      </ScrollHeader>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Event Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            {event.title}
          </h1>
          {event.description && (
            <p className="mb-4 text-gray-700 dark:text-gray-300">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Start:</span> {formatDate(event.startDate)}
            </div>
            {event.endDate && (
              <div>
                <span className="font-medium">End:</span> {formatDate(event.endDate)}
              </div>
            )}
            {event.location && (
              <div>
                <span className="font-medium">Location:</span> {event.location}
              </div>
            )}
          </div>
        </div>

        {/* Rating Display */}
        {event.ratingSummary && (
          <div className="mb-6">
            <RatingDisplay
              averageRating={event.ratingSummary.averageRating}
              totalReviews={event.ratingSummary.totalReviews}
              ratingDistribution={event.ratingSummary.ratingDistribution}
            />
          </div>
        )}

        {/* Review Form Toggle */}
        <div className="mb-6">
          <EventAccessGate
            requiredAccess={['registered', 'organizer']}
            viewerStatus={viewerStatus}
            unauthorizedMessage="Only registered attendees can submit reviews."
            unauthorizedDescription="Register for this event to unlock the review form."
          >
            {!showReviewForm ? (
              <button
                onClick={() => setShowReviewForm(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Write a Review
              </button>
            ) : (
              <div>
                <ReviewForm
                  eventId={eventId}
                  onSubmit={handleReviewSubmit}
                  onCancel={() => setShowReviewForm(false)}
                />
              </div>
            )}
          </EventAccessGate>
        </div>

        {/* Reviews List */}
        <div key={refreshKey}>
          <ReviewList eventId={eventId} />
        </div>
      </div>
    </div>
  );
}
