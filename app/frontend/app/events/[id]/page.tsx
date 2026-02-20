'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { eventsApi, Event } from '../../../lib/api/events';
import RatingDisplay from '../../../components/reviews/rating-display';
import ReviewList from '../../../components/reviews/review-list';
import ReviewForm from '../../../components/reviews/review-form';

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        const eventData = await eventsApi.getEvent(eventId);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Events</span>
        </Link>

        {/* Event Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {event.name}
          </h1>
          {event.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-4">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">Start:</span> {formatDate(event.startTime)}
            </div>
            {event.endTime && (
              <div>
                <span className="font-medium">End:</span> {formatDate(event.endTime)}
              </div>
            )}
            <div>
              <span className="font-medium">Contract:</span>{' '}
              <span className="font-mono text-xs">{event.contractAddress}</span>
            </div>
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
        </div>

        {/* Reviews List */}
        <div key={refreshKey}>
          <ReviewList eventId={eventId} />
        </div>
      </div>
    </div>
  );
}
