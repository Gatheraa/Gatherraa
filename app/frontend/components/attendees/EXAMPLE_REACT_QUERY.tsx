/**
 * Example: Attendee Discovery with React Query Integration
 * 
 * This example demonstrates:
 * - React Query for efficient data fetching and caching
 * - Optimistic updates
 * - Automatic refetching
 * - Error boundaries
 * 
 * Note: This project uses @tanstack/react-query
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendeeDiscovery } from '@/components/attendees';
import type { Attendee, AttendeeFilters } from '@/types/attendee';

interface FetchAttendeesParams {
  search?: string;
  filters?: AttendeeFilters;
  page?: number;
  pageSize?: number;
}

/**
 * API call to fetch attendees
 */
async function fetchAttendees(params: FetchAttendeesParams): Promise<Attendee[]> {
  const queryParams = new URLSearchParams();

  if (params.search) {
    queryParams.append('search', params.search);
  }

  if (params.filters?.experience?.length) {
    queryParams.append('experience', params.filters.experience.join(','));
  }

  if (params.filters?.interests?.length) {
    queryParams.append('interests', params.filters.interests.join(','));
  }

  if (params.filters?.skills?.length) {
    queryParams.append('skills', params.filters.skills.join(','));
  }

  if (params.filters?.verified) {
    queryParams.append('verified', 'true');
  }

  if (params.filters?.minRating) {
    queryParams.append('minRating', params.filters.minRating.toString());
  }

  const response = await fetch(`/api/attendees?${queryParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch attendees');
  }

  return response.json();
}

/**
 * API call to connect with an attendee
 */
async function connectWithAttendee(attendeeId: string): Promise<void> {
  const response = await fetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendeeId }),
  });

  if (!response.ok) {
    throw new Error('Failed to connect');
  }
}

export default function AttendeesPageWithReactQuery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AttendeeFilters>({});
  const queryClient = useQueryClient();

  // React Query: Fetch attendees
  const { data: attendees = [], isLoading, error } = useQuery<Attendee[]>({
    queryKey: ['attendees', searchQuery, filters],
    queryFn: () => fetchAttendees({ search: searchQuery, filters }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
  });

  // React Query: Mutation for connecting with attendees
  const { mutate: connectAttendee, isPending: isConnecting } = useMutation({
    mutationFn: connectWithAttendee,
    onMutate: async (attendeeId: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['attendees'] });

      const previousData = queryClient.getQueryData<Attendee[]>(['attendees']);

      if (previousData) {
        queryClient.setQueryData(
          ['attendees', searchQuery, filters],
          previousData.map((a) =>
            a.id === attendeeId ? { ...a, connected: true } : a
          )
        );
      }

      return previousData;
    },
    onError: (error, attendeeId, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(['attendees', searchQuery, filters], context);
      }
      console.error('Failed to connect:', error);
    },
    onSuccess: () => {
      // Refetch to confirm changes
      queryClient.invalidateQueries({ queryKey: ['attendees'] });
    },
  });

  /**
   * Handle search changes
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Handle filter changes
   */
  const handleFiltersChange = useCallback((newFilters: AttendeeFilters) => {
    setFilters(newFilters);
  }, []);

  /**
   * Handle connect action
   */
  const handleConnect = useCallback(
    (attendeeId: string) => {
      connectAttendee(attendeeId);
    },
    [connectAttendee]
  );

  /**
   * Handle view profile
   */
  const handleViewProfile = useCallback((attendeeId: string) => {
    window.location.href = `/attendees/${attendeeId}`;
  }, []);

  // Determine loading state
  const isLoadingData = isLoading || isConnecting;

  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['attendees'] })}
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
        loading={isLoadingData}
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

/**
 * Alternative: Using custom hook for cleaner component
 * 
 * export const useAttendeeDiscovery = () => {
 *   const [searchQuery, setSearchQuery] = useState('');
 *   const [filters, setFilters] = useState<AttendeeFilters>({});
 *   const queryClient = useQueryClient();
 *
 *   const { data: attendees = [], isLoading, error } = useQuery<Attendee[]>({
 *     queryKey: ['attendees', searchQuery, filters],
 *     queryFn: () => fetchAttendees({ search: searchQuery, filters }),
 *   });
 *
 *   const { mutate: connectAttendee } = useMutation({
 *     mutationFn: connectWithAttendee,
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: ['attendees'] });
 *     },
 *   });
 *
 *   return {
 *     attendees,
 *     isLoading,
 *     error,
 *     searchQuery,
 *     filters,
 *     setSearchQuery,
 *     setFilters,
 *     connectAttendee,
 *   };
 * };
 * 
 * export default function AttendeesPage() {
 *   const {
 *     attendees,
 *     isLoading,
 *     searchQuery,
 *     setSearchQuery,
 *     connectAttendee,
 *   } = useAttendeeDiscovery();
 *
 *   return (
 *     <div className="container mx-auto px-4 py-8">
 *       <AttendeeDiscovery
 *         attendees={attendees}
 *         loading={isLoading}
 *         onSearch={setSearchQuery}
 *         onConnect={connectAttendee}
 *       />
 *     </div>
 *   );
 * }
 */
