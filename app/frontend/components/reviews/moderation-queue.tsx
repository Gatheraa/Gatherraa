'use client';

import { useState, useEffect } from 'react';
import { reviewsApi, Review, ReviewStatus } from '../../lib/api/reviews';
import ReviewCard from './review-card';

export default function ModerationQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const limit = 20;

  const loadQueue = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await reviewsApi.getModerationQueue(page, limit);
      if (page === 1) {
        setReviews(response.data);
      } else {
        setReviews((prev) => [...prev, ...response.data]);
      }
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [page]);

  const handleModerate = async (
    reviewId: string,
    status: ReviewStatus,
    reason?: string,
  ) => {
    setModeratingId(reviewId);
    try {
      await reviewsApi.moderateReview(reviewId, status, reason);
      // Remove from queue
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error('Failed to moderate review:', err);
      alert('Failed to moderate review. Please try again.');
    } finally {
      setModeratingId(null);
    }
  };

  const handleApprove = (reviewId: string) => {
    handleModerate(reviewId, 'APPROVED');
  };

  const handleReject = (reviewId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason !== null) {
      handleModerate(reviewId, 'REJECTED', reason);
    }
  };

  const handleFlag = (reviewId: string) => {
    const reason = prompt('Please provide a reason for flagging:');
    if (reason !== null) {
      handleModerate(reviewId, 'FLAGGED', reason);
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading moderation queue...</div>
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={loadQueue}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Moderation Queue
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {total} review{total !== 1 ? 's' : ''} pending moderation
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-gray-600 dark:text-gray-400">No reviews pending moderation</div>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="relative">
              <ReviewCard review={review} />
              <div className="mt-4 flex gap-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <button
                  onClick={() => handleApprove(review.id)}
                  disabled={moderatingId === review.id}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(review.id)}
                  disabled={moderatingId === review.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleFlag(review.id)}
                  disabled={moderatingId === review.id}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Flag
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.length < total && (
        <div className="text-center">
          <button
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
