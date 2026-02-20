'use client';

import { useState } from 'react';
import { Star, ThumbsUp, Flag, Image as ImageIcon, Video } from 'lucide-react';
import { Review, reviewsApi, ReportReason } from '../../lib/api/reviews';

interface ReviewCardProps {
  review: Review;
  onVote?: () => void;
  onReport?: () => void;
  currentUserId?: string;
}

export default function ReviewCard({
  review,
  onVote,
  onReport,
  currentUserId,
}: ReviewCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [userHasVoted, setUserHasVoted] = useState(review.userHasVoted || false);
  const [userVoteIsHelpful, setUserVoteIsHelpful] = useState(
    review.userVoteIsHelpful || false,
  );

  const handleVote = async () => {
    if (isVoting || !currentUserId) return;

    setIsVoting(true);
    try {
      const isHelpful = userHasVoted && userVoteIsHelpful ? false : true;
      await reviewsApi.voteReview(review.id, isHelpful);

      if (userHasVoted && userVoteIsHelpful) {
        // Removing helpful vote
        setHelpfulCount((prev) => Math.max(0, prev - 1));
        setUserHasVoted(false);
        setUserVoteIsHelpful(false);
      } else if (userHasVoted && !userVoteIsHelpful) {
        // Switching from not helpful to helpful
        setHelpfulCount((prev) => prev + 1);
        setUserVoteIsHelpful(true);
      } else {
        // Adding helpful vote
        setHelpfulCount((prev) => prev + 1);
        setUserHasVoted(true);
        setUserVoteIsHelpful(true);
      }

      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleReport = async () => {
    if (isReporting || !currentUserId) return;

    const reason = prompt('Please select a reason:\n1. SPAM\n2. INAPPROPRIATE\n3. FAKE\n4. OTHER');
    if (!reason) return;

    let reportReason: ReportReason;
    switch (reason.trim().toUpperCase()) {
      case '1':
      case 'SPAM':
        reportReason = 'SPAM';
        break;
      case '2':
      case 'INAPPROPRIATE':
        reportReason = 'INAPPROPRIATE';
        break;
      case '3':
      case 'FAKE':
        reportReason = 'FAKE';
        break;
      case '4':
      case 'OTHER':
        reportReason = 'OTHER';
        break;
      default:
        alert('Invalid reason');
        return;
    }

    setIsReporting(true);
    try {
      await reviewsApi.reportReview(review.id, reportReason);
      alert('Review reported successfully');
      onReport?.();
    } catch (error) {
      console.error('Failed to report:', error);
      alert('Failed to report review. Please try again.');
    } finally {
      setIsReporting(false);
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
            {review.user.avatar ? (
              <img
                src={review.user.avatar}
                alt={review.user.username || 'User'}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-gray-600 dark:text-gray-400 font-semibold">
                {review.user.username?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {review.user.username || 'Anonymous'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(review.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-5 h-5 ${
                star <= review.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {review.title}
        </h3>
      )}

      {/* Content */}
      <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
        {review.content}
      </p>

      {/* Attachments */}
      {review.attachments && review.attachments.length > 0 && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {review.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            >
              {attachment.type === 'PHOTO' ? (
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleVote}
          disabled={isVoting || !currentUserId}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
            userHasVoted && userVoteIsHelpful
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="text-sm font-medium">
            Helpful ({helpfulCount})
          </span>
        </button>

        {currentUserId && review.userId !== currentUserId && (
          <button
            onClick={handleReport}
            disabled={isReporting}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Flag className="w-4 h-4" />
            <span className="text-sm">Report</span>
          </button>
        )}
      </div>
    </div>
  );
}
