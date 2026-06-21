'use client';

import React from 'react';
import { ExternalLink, MapPin, Award, Users, Star } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/molecules/Card';
import { Badge } from '@/components/ui/atoms/Badge';
import { Button } from '@/components/ui/atoms/Button';
import { Text } from '@/components/ui/atoms/Text';
import type { Attendee } from '@/types/attendee';
import './AttendeeProfileCard.css';

export interface AttendeeProfileCardProps {
  attendee: Attendee;
  onConnect?: (attendeeId: string) => void;
  onView?: (attendeeId: string) => void;
  className?: string;
}

/**
 * AttendeeProfileCard displays a single attendee's information in card format
 * with avatar, bio, interests, skills, and action buttons
 */
export const AttendeeProfileCard: React.FC<AttendeeProfileCardProps> = ({
  attendee,
  onConnect,
  onView,
  className = '',
}) => {
  const initials = attendee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card className={`attendee-profile-card overflow-hidden h-full flex flex-col ${className}`}>
      {/* Header with Avatar and Verification Badge */}
      <div className="relative bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 sm:p-6 pb-20">
        <div className="flex items-start justify-between">
          <div className="flex items-end gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                {attendee.avatar ? (
                  <img
                    src={attendee.avatar}
                    alt={attendee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {attendee.verified && (
                <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-1 border-2 border-white">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Rating Stars */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < Math.floor(attendee.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <Text variant="caption" className="text-gray-600">
                {attendee.rating.toFixed(1)}
              </Text>
            </div>
          </div>

          {/* Badge */}
          {attendee.experience && (
            <Badge
              variant={
                attendee.experience === 'expert'
                  ? 'primary'
                  : attendee.experience === 'advanced'
                    ? 'success'
                    : 'secondary'
              }
              className="capitalize"
            >
              {attendee.experience}
            </Badge>
          )}
        </div>
      </div>

      {/* Name and Title */}
      <CardContent className="pt-4">
        <Text as="h3" variant="heading-sm" className="mb-1">
          {attendee.name}
        </Text>
        {attendee.title && (
          <Text variant="body-sm" className="text-gray-600 mb-2">
            {attendee.title}
          </Text>
        )}

        {/* Location */}
        {attendee.location && (
          <div className="flex items-center gap-1 mb-3 text-gray-600">
            <MapPin size={14} />
            <Text variant="caption">{attendee.location}</Text>
          </div>
        )}

        {/* Bio */}
        {attendee.bio && (
          <Text variant="body-sm" className="text-gray-700 mb-3 line-clamp-2">
            {attendee.bio}
          </Text>
        )}

        {/* Attendance and Awards Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <div>
              <Text variant="caption" className="text-gray-600">
                Events
              </Text>
              <Text variant="body-sm" className="font-semibold">
                {attendee.attendanceCount}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Award size={16} className="text-amber-600" />
            <div>
              <Text variant="caption" className="text-gray-600">
                Badges
              </Text>
              <Text variant="body-sm" className="font-semibold">
                {attendee.badges.length}
              </Text>
            </div>
          </div>
        </div>

        {/* Interests - Limited to 3 */}
        {attendee.interests.length > 0 && (
          <div className="mb-3">
            <Text variant="caption" className="text-gray-600 mb-2 block">
              Interests
            </Text>
            <div className="flex flex-wrap gap-2">
              {attendee.interests.slice(0, 3).map((interest, idx) => (
                <Badge key={idx} variant="secondary" size="sm">
                  {interest}
                </Badge>
              ))}
              {attendee.interests.length > 3 && (
                <Badge variant="secondary" size="sm">
                  +{attendee.interests.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Skills - Limited to 3 */}
        {attendee.skills.length > 0 && (
          <div className="mb-3">
            <Text variant="caption" className="text-gray-600 mb-2 block">
              Skills
            </Text>
            <div className="flex flex-wrap gap-2">
              {attendee.skills.slice(0, 3).map((skill, idx) => (
                <Badge key={idx} variant="outline" size="sm">
                  {skill}
                </Badge>
              ))}
              {attendee.skills.length > 3 && (
                <Badge variant="outline" size="sm">
                  +{attendee.skills.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Social Links */}
        {attendee.social && Object.values(attendee.social).some(Boolean) && (
          <div className="flex gap-2 mb-3">
            {attendee.social.twitter && (
              <a
                href={`https://twitter.com/${attendee.social.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter profile"
                className="text-blue-500 hover:text-blue-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7" />
                </svg>
              </a>
            )}
            {attendee.social.linkedin && (
              <a
                href={`https://linkedin.com/in/${attendee.social.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn profile"
                className="text-blue-700 hover:text-blue-800"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            )}
            {attendee.social.github && (
              <a
                href={`https://github.com/${attendee.social.github}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub profile"
                className="text-gray-800 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            )}
          </div>
        )}
      </CardContent>

      {/* Action Buttons */}
      <CardFooter className="flex gap-2 mt-auto">
        {onView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(attendee.id)}
            className="flex-1"
          >
            View Profile
          </Button>
        )}
        {onConnect && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConnect(attendee.id)}
            className="flex-1"
          >
            Connect
          </Button>
        )}
        {!onView && !onConnect && attendee.website && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex-1"
          >
            <a href={attendee.website} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="mr-1" />
              Website
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

AttendeeProfileCard.displayName = 'AttendeeProfileCard';
