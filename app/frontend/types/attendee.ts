/**
 * Attendee types and interfaces for the discovery interface
 */

export interface Attendee {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  bio?: string;
  interests: string[];
  skills: string[];
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  location?: string;
  verified: boolean;
  attendanceCount: number;
  rating: number;
  badges: string[];
  joinedAt: string | Date;
  website?: string;
  social?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export interface AttendeeFilters {
  experience?: Attendee['experience'][];
  interests?: string[];
  skills?: string[];
  verified?: boolean;
  minRating?: number;
  location?: string;
  attendanceRange?: {
    min: number;
    max: number;
  };
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AttendeeDiscoveryResponse {
  attendees: Attendee[];
  pagination: PaginationState;
  filters?: AttendeeFilters;
}
