'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { SearchInput } from '@/components/ui/atoms/SearchInput';
import { Button } from '@/components/ui/atoms/Button';
import { Text } from '@/components/ui/atoms/Text';
import { Spinner } from '@/components/ui/atoms/Spinner';
import { AttendeeProfileCard } from './AttendeeProfileCard';
import { AttendeeFilters } from './AttendeeFilters';
import { Pagination } from './Pagination';
import { usePagination } from '@/hooks/usePagination';
import type { Attendee, AttendeeFilters as AttendeeFiltersType } from '@/types/attendee';
import './AttendeeDiscovery.css';

export interface AttendeeDiscoveryProps {
  /** List of attendees to display */
  attendees: Attendee[];
  /** Whether data is loading */
  loading?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Default page size */
  defaultPageSize?: number;
  /** Show page size selector in pagination */
  showPageSizeSelector?: boolean;
  /** Page size options */
  pageSizeOptions?: number[];
  /** All available skills for filtering */
  availableSkills?: string[];
  /** All available interests for filtering */
  availableInterests?: string[];
  /** Callback when connect button is clicked */
  onConnect?: (attendeeId: string) => void;
  /** Callback when view profile button is clicked */
  onViewProfile?: (attendeeId: string) => void;
  /** Callback when search changes */
  onSearch?: (query: string) => void;
  /** Callback when filters change */
  onFiltersChange?: (filters: AttendeeFiltersType) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** CSS class */
  className?: string;
}

/**
 * AttendeeDiscovery - Main component for discovering and browsing attendees
 * Features: Search, filtering, profile cards, and pagination
 */
export const AttendeeDiscovery: React.FC<AttendeeDiscoveryProps> = ({
  attendees,
  loading = false,
  searchPlaceholder = 'Search attendees by name, title, or skills...',
  defaultPageSize = 12,
  showPageSizeSelector = false,
  pageSizeOptions = [12, 24, 48],
  availableSkills = [],
  availableInterests = [],
  onConnect,
  onViewProfile,
  onSearch,
  onFiltersChange,
  emptyMessage = 'No attendees found. Try adjusting your search or filters.',
  className = '',
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AttendeeFiltersType>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Extract unique skills and interests from attendees if not provided
  const allSkills = useMemo(
    () =>
      availableSkills.length > 0
        ? availableSkills
        : Array.from(
            new Set(attendees.flatMap((a) => a.skills)).values()
          ).sort(),
    [availableSkills, attendees]
  );

  const allInterests = useMemo(
    () =>
      availableInterests.length > 0
        ? availableInterests
        : Array.from(
            new Set(attendees.flatMap((a) => a.interests)).values()
          ).sort(),
    [availableInterests, attendees]
  );

  // Filter attendees based on search and filters
  const filteredAttendees = useMemo(() => {
    return attendees.filter((attendee) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          attendee.name.toLowerCase().includes(query) ||
          attendee.title?.toLowerCase().includes(query) ||
          attendee.bio?.toLowerCase().includes(query) ||
          attendee.skills.some((s) => s.toLowerCase().includes(query)) ||
          attendee.interests.some((i) => i.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      // Experience filter
      if (filters.experience && filters.experience.length > 0) {
        if (!attendee.experience || !filters.experience.includes(attendee.experience)) {
          return false;
        }
      }

      // Interests filter
      if (filters.interests && filters.interests.length > 0) {
        const hasInterest = filters.interests.some((interest) =>
          attendee.interests.includes(interest)
        );
        if (!hasInterest) return false;
      }

      // Skills filter
      if (filters.skills && filters.skills.length > 0) {
        const hasSkill = filters.skills.some((skill) =>
          attendee.skills.includes(skill)
        );
        if (!hasSkill) return false;
      }

      // Verified filter
      if (filters.verified && !attendee.verified) {
        return false;
      }

      // Rating filter
      if (filters.minRating && attendee.rating < filters.minRating) {
        return false;
      }

      // Location filter
      if (filters.location && !attendee.location?.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }

      // Attendance range filter
      if (filters.attendanceRange) {
        const { min, max } = filters.attendanceRange;
        if (attendee.attendanceCount < min || attendee.attendanceCount > max) {
          return false;
        }
      }

      return true;
    });
  }, [attendees, searchQuery, filters]);

  // Pagination
  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: defaultPageSize,
    total: filteredAttendees.length,
  });

  // Get paginated attendees
  const paginatedAttendees = useMemo(() => {
    return filteredAttendees.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredAttendees, pagination.startIndex, pagination.endIndex]);

  // Handlers
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
    // Reset to first page when search changes
    pagination.goToFirstPage();
  };

  const handleFiltersChange = (newFilters: AttendeeFiltersType) => {
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
    // Reset to first page when filters change
    pagination.goToFirstPage();
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchQuery('');
    pagination.goToFirstPage();
    onSearch?.('');
    onFiltersChange?.({});
  };

  return (
    <div className={`attendee-discovery ${className}`}>
      {/* Header with Search */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Search size={20} className="text-gray-600" />
          <Text as="h2" variant="heading-md">
            Discover Attendees
          </Text>
        </div>

        <SearchInput
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          debounceMs={300}
          showClear={true}
          containerClassName="w-full"
          className="w-full"
          minChars={0}
        />
      </div>

      {/* Main Layout: Filters Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters - Hidden on mobile, shown as overlay when toggled */}
        <div className="hidden lg:block lg:col-span-1">
          <AttendeeFilters
            availableSkills={allSkills}
            availableInterests={allInterests}
            filters={filters}
            onFilterChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Mobile Filter Button */}
        <div className="lg:hidden mb-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <Filter size={18} className="mr-2" />
            Filters
          </Button>
        </div>

        {/* Mobile Filters Overlay */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute top-0 left-0 right-0 max-h-screen overflow-y-auto bg-white rounded-b-lg shadow-lg">
              <div className="p-4 flex items-center justify-between border-b border-gray-200">
                <Text as="h3" variant="heading-sm">
                  Filters
                </Text>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                <AttendeeFilters
                  availableSkills={allSkills}
                  availableInterests={allInterests}
                  filters={filters}
                  onFilterChange={(newFilters) => {
                    handleFiltersChange(newFilters);
                    setShowMobileFilters(false);
                  }}
                  onClearFilters={() => {
                    handleClearFilters();
                    setShowMobileFilters(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* Results Info */}
          <div className="mb-4">
            <Text variant="body-sm" className="text-gray-600">
              Found <span className="font-semibold">{filteredAttendees.length}</span> attendee
              {filteredAttendees.length !== 1 ? 's' : ''}
              {searchQuery || Object.keys(filters).length > 0 ? ' matching your search' : ''}
            </Text>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <Text variant="body-sm" className="text-gray-600">
                Loading attendees...
              </Text>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredAttendees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="text-4xl">👥</div>
              <Text as="h3" variant="heading-sm">
                No attendees found
              </Text>
              <Text variant="body-sm" className="text-gray-600 text-center max-w-sm">
                {emptyMessage}
              </Text>
              {(searchQuery || Object.keys(filters).length > 0) && (
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear search and filters
                </Button>
              )}
            </div>
          )}

          {/* Attendee Grid */}
          {!loading && filteredAttendees.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {paginatedAttendees.map((attendee) => (
                  <AttendeeProfileCard
                    key={attendee.id}
                    attendee={attendee}
                    onConnect={onConnect}
                    onView={onViewProfile}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalItems={filteredAttendees.length}
                    pageSize={pagination.pageSize}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                    pageSizeOptions={pageSizeOptions}
                    showPageSizeSelector={showPageSizeSelector}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

AttendeeDiscovery.displayName = 'AttendeeDiscovery';
