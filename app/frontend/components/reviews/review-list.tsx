'use client';

import { useState, useEffect } from 'react';
import { reviewsApi, Review, ReviewSort } from '../../lib/api/reviews';
import ReviewCard from './review-card';

interface ReviewListProps {
  eventId?: string;
  currentUserId?: string;
  onReviewUpdate?: () => void;
}

export default function ReviewList({
  eventId,
  currentUserId,
  onReviewUpdate,
}: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const loadReviews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = eventId
        ? await reviewsApi.getReviews(eventId, {
            sort,
            rating: ratingFilter,
            page,
            limit,
          })
        : await reviewsApi.getAllReviews(
            eventId ? { eventId } : undefined,
            sort,
            page,
            limit,
          );

      if (page === 1) {
        setReviews(response.data);
      } else {
        setReviews((prev) => [...prev, ...response.data]);
      }

      setTotal(response.total);
      setHasMore(response.data.length === limit && reviews.length + response.data.length < response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [eventId, sort, ratingFilter, page]);

  const handleSortChange = (newSort: ReviewSort) => {
    setSort(newSort);
    setPage(1);
  };

  const handleRatingFilterChange = (rating: number | undefined) => {
    setRatingFilter(rating);
    setPage(1);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading reviews...</div>
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={loadReviews}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Sort */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort by
            </label>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as ReviewSort)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="lowest_rated">Lowest Rated</option>
              <option value="most_helpful">Most Helpful</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Rating
            </label>
            <select
              value={ratingFilter || ''}
              onChange={(e) =>
                handleRatingFilterChange(
                  e.target.value ? parseInt(e.target.value) : undefined,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {reviews.length} of {total} reviews
      </div>

      {/* Reviews */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-gray-600 dark:text-gray-400">No reviews yet</div>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              onVote={onReviewUpdate}
              onReport={onReviewUpdate}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
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
