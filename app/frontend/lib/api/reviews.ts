import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
export type ReportReason = 'SPAM' | 'INAPPROPRIATE' | 'FAKE' | 'OTHER';
export type ReviewSort = 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful';

export interface ReviewAttachment {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  size: number;
}

export interface UserSummary {
  id: string;
  username: string | null;
  avatar: string | null;
}

export interface Review {
  id: string;
  eventId: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string;
  status: ReviewStatus;
  helpfulCount: number;
  reportCount: number;
  user: UserSummary;
  attachments: ReviewAttachment[];
  userHasVoted?: boolean;
  userVoteIsHelpful?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewDto {
  rating: number;
  title?: string;
  content: string;
  attachments?: Omit<ReviewAttachment, 'id'>[];
}

export interface UpdateReviewDto {
  title?: string;
  content?: string;
}

export interface ReviewListResponse {
  data: Review[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewFilters {
  eventId?: string;
  userId?: string;
  rating?: number;
  status?: ReviewStatus;
  hasAttachments?: boolean;
}

export const reviewsApi = {
  createReview: async (
    eventId: string,
    data: CreateReviewDto,
    files?: File[],
  ): Promise<Review> => {
    const formData = new FormData();
    
    // Add review data
    formData.append('rating', data.rating.toString());
    if (data.title) formData.append('title', data.title);
    formData.append('content', data.content);

    // Add files if provided
    if (files && files.length > 0) {
      files.forEach((file) => {
        formData.append('files', file);
      });
    }

    return apiPost<Review>(`/reviews/events/${eventId}/reviews`, formData);
  },

  getReviews: async (
    eventId: string,
    params?: {
      sort?: ReviewSort;
      rating?: number;
      page?: number;
      limit?: number;
    },
  ): Promise<ReviewListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.rating) queryParams.append('rating', params.rating.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiGet<ReviewListResponse>(
      `/reviews/events/${eventId}/reviews?${queryParams.toString()}`,
    );
  },

  getAllReviews: async (
    filters?: ReviewFilters,
    sort?: ReviewSort,
    page?: number,
    limit?: number,
  ): Promise<ReviewListResponse> => {
    const queryParams = new URLSearchParams();
    if (filters?.eventId) queryParams.append('eventId', filters.eventId);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.rating) queryParams.append('rating', filters.rating.toString());
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.hasAttachments) queryParams.append('hasAttachments', 'true');
    if (sort) queryParams.append('sort', sort);
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());

    return apiGet<ReviewListResponse>(`/reviews?${queryParams.toString()}`);
  },

  getReview: async (id: string): Promise<Review> => {
    return apiGet<Review>(`/reviews/${id}`);
  },

  updateReview: async (id: string, data: UpdateReviewDto): Promise<Review> => {
    return apiPatch<Review>(`/reviews/${id}`, data);
  },

  deleteReview: async (id: string): Promise<{ message: string }> => {
    return apiDelete<{ message: string }>(`/reviews/${id}`);
  },

  voteReview: async (id: string, isHelpful: boolean): Promise<Review> => {
    return apiPost<Review>(`/reviews/${id}/vote`, { isHelpful });
  },

  reportReview: async (
    id: string,
    reason: ReportReason,
    description?: string,
  ): Promise<{ message: string }> => {
    return apiPost<{ message: string }>(`/reviews/${id}/report`, { reason, description });
  },

  getModerationQueue: async (
    page?: number,
    limit?: number,
  ): Promise<ReviewListResponse> => {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (limit) queryParams.append('limit', limit.toString());

    return apiGet<ReviewListResponse>(
      `/reviews/moderation/queue?${queryParams.toString()}`,
    );
  },

  moderateReview: async (
    id: string,
    status: ReviewStatus,
    moderationReason?: string,
  ): Promise<Review> => {
    return apiPost<Review>(`/reviews/${id}/moderate`, { status, moderationReason });
  },
};
