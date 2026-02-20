import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface Event {
  id: string;
  contractAddress: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  organizerId: string;
  ratingSummary?: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventDto {
  contractAddress: string;
  name: string;
  description?: string;
  startTime: string;
  endTime?: string;
  organizerId: string;
}

export interface UpdateEventDto {
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
}

export interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
}

export const eventsApi = {
  getEvents: async (page: number = 1, limit: number = 20): Promise<EventListResponse> => {
    return apiGet<EventListResponse>(`/events?page=${page}&limit=${limit}`);
  },

  getEvent: async (id: string): Promise<Event> => {
    return apiGet<Event>(`/events/${id}`);
  },

  createEvent: async (data: CreateEventDto): Promise<Event> => {
    return apiPost<Event>('/events', data);
  },

  updateEvent: async (id: string, data: UpdateEventDto): Promise<Event> => {
    return apiPatch<Event>(`/events/${id}`, data);
  },

  deleteEvent: async (id: string): Promise<{ message: string }> => {
    return apiDelete<{ message: string }>(`/events/${id}`);
  },
};
