import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface EventFilters {
  organizerId?: string;
  organizerName?: string;
  status?: string;
  type?: string;
  category?: string;
  isPublic?: boolean;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  isFeatured?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  startDate: string;
  endDate?: string;
  location: string;
  organizerId: string;
  organizerName: string;
  price?: number;
  capacity: number;
  isFeatured: boolean;
  registeredCount: number;
  attendanceCount: number;
  status: string;
  isPublic: boolean;
  imageUrl?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  statistics?: {
    views?: number;
    shares?: number;
    favorites?: number;
    avgRating?: number;
  };
  isDeleted: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
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

export interface EventFilters {
  organizerId?: string;
  status?: string;
  type?: string;
  category?: string;
  isPublic?: boolean;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  isFeatured?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const eventsApi = {
  getEvents: async (page: number = 1, limit: number = 20): Promise<EventListResponse> => {
    return apiGet<EventListResponse>(`/events?page=${page}&limit=${limit}`);
  },

  searchEvents: async (filters: EventFilters): Promise<{ events: Event[]; total: number }> => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    return apiGet<{ events: Event[]; total: number }>(`/events/search?${params.toString()}`);
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
