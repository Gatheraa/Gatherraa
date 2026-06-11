'use client';

import React, { useMemo } from 'react';

interface EventStatusBadgeProps {
  startTime: Date;
  endTime: Date;
  capacity: number;
  attendees: number;
}

const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({
  startTime,
  endTime,
  capacity,
  attendees,
}) => {
  const status = useMemo(() => {
    const now = new Date();

    if (now < startTime) {
      return 'Upcoming';
    } else if (now >= startTime && now <= endTime) {
      return 'Live';
    } else if (now > endTime) {
      return 'Ended';
    } else if (attendees >= capacity) {
      return 'Sold Out';
    }
    return 'Upcoming'; // Default to upcoming if none of the conditions are met
  }, [startTime, endTime, capacity, attendees]);

  const badgeColor = useMemo(() => {
    switch (status) {
      case 'Upcoming':
        return 'bg-blue-200 text-blue-700';
      case 'Live':
        return 'bg-green-200 text-green-700';
      case 'Ended':
        return 'bg-gray-200 text-gray-700';
      case 'Sold Out':
        return 'bg-red-200 text-red-700';
      default:
        return 'bg-blue-200 text-blue-700';
    }
  }, [status]);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}
    >
      {status}
    </span>
  );
};

export default EventStatusBadge;

/*
Example Usage:
<EventStatusBadge startTime={new Date('2024-01-01T10:00:00')} endTime={new Date('2024-01-01T12:00:00')} capacity={100} attendees={50} />
*/