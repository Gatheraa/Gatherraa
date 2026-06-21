/**
 * Example: Advanced Attendee Discovery with Server-Side Search & Filtering
 * 
 * This example demonstrates:
 * - Server-side search and filtering
 * - API integration
 * - Loading states
 * - Error handling
 * - Database queries
 */

'use client';

import { useCallback, useState } from 'react';
import { AttendeeDiscovery } from '@/components/attendees';
import type { Attendee, AttendeeFilters } from '@/types/attendee';

interface SearchParams {
  query: string;
  filters: AttendeeFilters;
  page: number;
  pageSize: number;
}

export default function AdvancedAttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: '',
    filters: {},
    page: 1,
    pageSize: 12,
  });

  /**
   * Fetch attendees from API with search and filters
   */
  const fetchAttendees = useCallback(async (params: SearchParams) => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams();
      
      if (params.query) {
        queryParams.append('search', params.query);
      }

      if (params.filters.experience?.length) {
        queryParams.append('experience', params.filters.experience.join(','));
      }

      if (params.filters.interests?.length) {
        queryParams.append('interests', params.filters.interests.join(','));
      }

      if (params.filters.skills?.length) {
        queryParams.append('skills', params.filters.skills.join(','));
      }

      if (params.filters.verified) {
        queryParams.append('verified', 'true');
      }

      if (params.filters.minRating) {
        queryParams.append('minRating', params.filters.minRating.toString());
      }

      queryParams.append('page', params.page.toString());
      queryParams.append('pageSize', params.pageSize.toString());

      // Fetch from your API
      const response = await fetch(`/api/attendees?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendees');
      }

      const data = await response.json();
      setAttendees(data.attendees);
      setSearchParams(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Failed to fetch attendees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle search input changes
   */
  const handleSearch = useCallback(
    (query: string) => {
      const newParams = { ...searchParams, query, page: 1 };
      fetchAttendees(newParams);
    },
    [searchParams, fetchAttendees]
  );

  /**
   * Handle filter changes
   */
  const handleFiltersChange = useCallback(
    (filters: AttendeeFilters) => {
      const newParams = { ...searchParams, filters, page: 1 };
      fetchAttendees(newParams);
    },
    [searchParams, fetchAttendees]
  );

  /**
   * Handle pagination changes
   */
  const handlePageChange = useCallback(
    (page: number) => {
      const newParams = { ...searchParams, page };
      fetchAttendees(newParams);
    },
    [searchParams, fetchAttendees]
  );

  /**
   * Handle connect action
   */
  const handleConnect = useCallback(async (attendeeId: string) => {
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendeeId }),
      });

      if (response.ok) {
        // Show success message
        console.log('Connected successfully');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }, []);

  /**
   * Handle view profile
   */
  const handleViewProfile = useCallback((attendeeId: string) => {
    // Navigate to profile page
    window.location.href = `/attendees/${attendeeId}`;
  }, []);

  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={() => fetchAttendees(searchParams)}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AttendeeDiscovery
        attendees={attendees}
        loading={loading}
        defaultPageSize={12}
        showPageSizeSelector={true}
        pageSizeOptions={[12, 24, 48]}
        onSearch={handleSearch}
        onFiltersChange={handleFiltersChange}
        onConnect={handleConnect}
        onViewProfile={handleViewProfile}
      />
    </div>
  );
}
