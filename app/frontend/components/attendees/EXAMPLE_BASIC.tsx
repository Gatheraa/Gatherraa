/**
 * Example: Basic Attendee Discovery Page
 * 
 * This example shows how to integrate the AttendeeDiscovery component
 * into a page with basic functionality.
 */

'use client';

import { useEffect, useState } from 'react';
import { AttendeeDiscovery } from '@/components/attendees';
import type { Attendee, AttendeeFilters } from '@/types/attendee';

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call to fetch attendees
    const fetchAttendees = async () => {
      try {
        setLoading(true);
        // Replace with your actual API call
        // const response = await fetch('/api/attendees');
        // const data = await response.json();

        // Mock data for demonstration
        const mockData: Attendee[] = [
          {
            id: '1',
            name: 'Alice Johnson',
            title: 'Senior Product Manager',
            bio: 'Passionate about building products that solve real problems.',
            avatar: undefined,
            interests: ['Web3', 'Product Management'],
            skills: ['Product Strategy', 'User Research'],
            experience: 'advanced',
            location: 'San Francisco, CA',
            verified: true,
            attendanceCount: 12,
            rating: 4.8,
            badges: ['Early Adopter', 'Speaker'],
            joinedAt: new Date('2023-01-15'),
            website: 'https://alice.dev',
            social: {
              twitter: 'alicejohnson',
              linkedin: 'alice-johnson',
            },
          },
          // Add more attendees...
        ];

        setAttendees(mockData);
      } catch (error) {
        console.error('Failed to fetch attendees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();
  }, []);

  const handleConnect = (attendeeId: string) => {
    console.log('Connect request for:', attendeeId);
    // Handle connection logic - e.g., send message, add to contacts, etc.
  };

  const handleViewProfile = (attendeeId: string) => {
    console.log('View profile for:', attendeeId);
    // Navigate to profile page or open modal
    // router.push(`/attendees/${attendeeId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <AttendeeDiscovery
        attendees={attendees}
        loading={loading}
        defaultPageSize={12}
        onConnect={handleConnect}
        onViewProfile={handleViewProfile}
      />
    </div>
  );
}
