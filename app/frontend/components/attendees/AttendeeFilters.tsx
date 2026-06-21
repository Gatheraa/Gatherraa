'use client';

import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/molecules/Card';
import { Button } from '@/components/ui/atoms/Button';
import { Badge } from '@/components/ui/atoms/Badge';
import { Text } from '@/components/ui/atoms/Text';
import type { AttendeeFilters, Attendee } from '@/types/attendee';
import './AttendeeFilters.css';

export interface AttendeeFiltersProps {
  /** All available skills for filtering */
  availableSkills: string[];
  /** All available interests for filtering */
  availableInterests: string[];
  /** Current filter state */
  filters: AttendeeFilters;
  /** Callback when filters change */
  onFilterChange: (filters: AttendeeFilters) => void;
  /** Callback to clear all filters */
  onClearFilters: () => void;
  /** Show filter panel on mobile */
  isMobileOpen?: boolean;
  /** Close filter panel on mobile */
  onMobileClose?: () => void;
}

/**
 * AttendeeFilters provides filtering options for attendee discovery
 * Supports filtering by experience level, interests, skills, verification, rating, and attendance
 */
export const AttendeeFilters: React.FC<AttendeeFiltersProps> = ({
  availableSkills,
  availableInterests,
  filters,
  onFilterChange,
  onClearFilters,
  isMobileOpen = true,
  onMobileClose,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    experience: true,
    interests: true,
    skills: true,
    other: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExperienceChange = (level: Attendee['experience']) => {
    const current = filters.experience || [];
    const updated = current.includes(level)
      ? current.filter((x) => x !== level)
      : [...current, level];
    onFilterChange({
      ...filters,
      experience: updated.length > 0 ? updated : undefined,
    });
  };

  const handleInterestToggle = (interest: string) => {
    const current = filters.interests || [];
    const updated = current.includes(interest)
      ? current.filter((x) => x !== interest)
      : [...current, interest];
    onFilterChange({
      ...filters,
      interests: updated.length > 0 ? updated : undefined,
    });
  };

  const handleSkillToggle = (skill: string) => {
    const current = filters.skills || [];
    const updated = current.includes(skill)
      ? current.filter((x) => x !== skill)
      : [...current, skill];
    onFilterChange({
      ...filters,
      skills: updated.length > 0 ? updated : undefined,
    });
  };

  const handleVerifiedChange = () => {
    onFilterChange({
      ...filters,
      verified: filters.verified ? undefined : true,
    });
  };

  const handleMinRatingChange = (rating: number) => {
    onFilterChange({
      ...filters,
      minRating: filters.minRating === rating ? undefined : rating,
    });
  };

  const hasActiveFilters =
    (filters.experience && filters.experience.length > 0) ||
    (filters.interests && filters.interests.length > 0) ||
    (filters.skills && filters.skills.length > 0) ||
    filters.verified ||
    filters.minRating;

  const experienceLevels: Attendee['experience'][] = ['beginner', 'intermediate', 'advanced', 'expert'];

  return (
    <Card className="attendee-filters">
      <CardContent className="p-4 sm:p-6">
        {/* Header with clear button */}
        <div className="flex items-center justify-between mb-4">
          <Text as="h3" variant="heading-sm">
            Filters
          </Text>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Experience Level Filter */}
        <div className="border-b border-gray-200 pb-4 mb-4">
          <button
            onClick={() => toggleSection('experience')}
            className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2"
          >
            <Text variant="body-sm" className="font-semibold">
              Experience Level
            </Text>
            <ChevronDown
              size={18}
              className={`transition-transform ${expandedSections.experience ? 'rotate-180' : ''}`}
            />
          </button>
          {expandedSections.experience && (
            <div className="space-y-2 mt-2">
              {experienceLevels.map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={(filters.experience || []).includes(level)}
                    onChange={() => handleExperienceChange(level)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Text variant="body-sm" className="capitalize">
                    {level}
                  </Text>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Rating Filter */}
        <div className="border-b border-gray-200 pb-4 mb-4">
          <button
            onClick={() => toggleSection('rating')}
            className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2"
          >
            <Text variant="body-sm" className="font-semibold">
              Minimum Rating
            </Text>
            <ChevronDown
              size={18}
              className={`transition-transform ${expandedSections.rating ? 'rotate-180' : ''}`}
            />
          </button>
          {expandedSections.rating && (
            <div className="space-y-2 mt-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <label key={rating} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={filters.minRating === rating}
                    onChange={() => handleMinRatingChange(rating)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex items-center gap-1">
                    {[...Array(rating)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <Text variant="caption" className="text-gray-600 ml-2">
                      {rating}+
                    </Text>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Interests Filter */}
        {availableInterests.length > 0 && (
          <div className="border-b border-gray-200 pb-4 mb-4">
            <button
              onClick={() => toggleSection('interests')}
              className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2"
            >
              <Text variant="body-sm" className="font-semibold">
                Interests ({availableInterests.length})
              </Text>
              <ChevronDown
                size={18}
                className={`transition-transform ${expandedSections.interests ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.interests && (
              <div className="flex flex-wrap gap-2 mt-2">
                {availableInterests.map((interest) => (
                  <Badge
                    key={interest}
                    variant={
                      (filters.interests || []).includes(interest) ? 'primary' : 'secondary'
                    }
                    className="cursor-pointer"
                    onClick={() => handleInterestToggle(interest)}
                  >
                    {(filters.interests || []).includes(interest) && (
                      <X size={12} className="mr-1" />
                    )}
                    {interest}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skills Filter */}
        {availableSkills.length > 0 && (
          <div className="border-b border-gray-200 pb-4 mb-4">
            <button
              onClick={() => toggleSection('skills')}
              className="w-full flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2"
            >
              <Text variant="body-sm" className="font-semibold">
                Skills ({availableSkills.length})
              </Text>
              <ChevronDown
                size={18}
                className={`transition-transform ${expandedSections.skills ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.skills && (
              <div className="flex flex-wrap gap-2 mt-2">
                {availableSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant={
                      (filters.skills || []).includes(skill) ? 'primary' : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => handleSkillToggle(skill)}
                  >
                    {(filters.skills || []).includes(skill) && (
                      <X size={12} className="mr-1" />
                    )}
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Verification Filter */}
        <div className="pb-4">
          <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={filters.verified || false}
              onChange={handleVerifiedChange}
              className="w-4 h-4 rounded border-gray-300"
            />
            <Text variant="body-sm">Show only verified attendees</Text>
          </label>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Text variant="caption" className="text-gray-600 mb-2 block">
              Active Filters
            </Text>
            <div className="flex flex-wrap gap-2">
              {(filters.experience || []).map((exp) => (
                <Badge key={`exp-${exp}`} variant="primary" size="sm">
                  {exp}
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={() => handleExperienceChange(exp)}
                  />
                </Badge>
              ))}
              {(filters.interests || []).map((interest) => (
                <Badge key={`int-${interest}`} variant="primary" size="sm">
                  {interest}
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={() => handleInterestToggle(interest)}
                  />
                </Badge>
              ))}
              {(filters.skills || []).map((skill) => (
                <Badge key={`skill-${skill}`} variant="primary" size="sm">
                  {skill}
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={() => handleSkillToggle(skill)}
                  />
                </Badge>
              ))}
              {filters.verified && (
                <Badge variant="primary" size="sm">
                  Verified
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={handleVerifiedChange}
                  />
                </Badge>
              )}
              {filters.minRating && (
                <Badge variant="primary" size="sm">
                  {filters.minRating}+ stars
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={() => handleMinRatingChange(filters.minRating || 0)}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

AttendeeFilters.displayName = 'AttendeeFilters';
