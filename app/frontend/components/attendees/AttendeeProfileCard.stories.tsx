import type { Meta, StoryObj } from '@storybook/react';
import { AttendeeProfileCard } from './AttendeeProfileCard';
import type { Attendee } from '@/types/attendee';

const meta: Meta<typeof AttendeeProfileCard> = {
  title: 'Attendees/AttendeeProfileCard',
  component: AttendeeProfileCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockAttendee: Attendee = {
  id: '1',
  name: 'Alice Johnson',
  title: 'Senior Product Manager',
  bio: 'Passionate about building products that solve real problems. Experienced in blockchain and Web3.',
  avatar: undefined,
  interests: ['Web3', 'Product Management', 'Design Thinking', 'User Experience'],
  skills: ['Product Strategy', 'User Research', 'Analytics', 'Prototyping'],
  experience: 'advanced',
  location: 'San Francisco, CA',
  verified: true,
  attendanceCount: 12,
  rating: 4.8,
  badges: ['Early Adopter', 'Event Organizer', 'Speaker'],
  joinedAt: new Date('2023-01-15'),
  website: 'https://alice.dev',
  social: {
    twitter: 'alicejohnson',
    linkedin: 'alice-johnson',
    github: 'alice-johnson',
  },
};

const expertAttendee: Attendee = {
  id: '2',
  name: 'Bob Chen',
  title: 'Lead Blockchain Engineer',
  bio: 'Building with React, Node.js, and smart contracts. Always learning and sharing knowledge.',
  avatar: undefined,
  interests: ['Smart Contracts', 'Full Stack Development', 'DevOps', 'Security'],
  skills: ['TypeScript', 'Solidity', 'Docker', 'Go', 'Rust'],
  experience: 'expert',
  location: 'Austin, TX',
  verified: true,
  attendanceCount: 24,
  rating: 4.9,
  badges: ['Expert', 'Contributor', 'Mentor', 'Speaker'],
  joinedAt: new Date('2022-06-20'),
  website: 'https://bobchen.dev',
  social: {
    twitter: 'bobchen',
    github: 'bob-chen',
    linkedin: 'bob-chen',
  },
};

const beginnerAttendee: Attendee = {
  id: '8',
  name: 'Henry Park',
  title: 'Junior Developer',
  bio: 'Learning blockchain development and Web3. Excited about the future!',
  avatar: undefined,
  interests: ['Blockchain', 'Web3', 'Learning'],
  skills: ['JavaScript', 'React', 'Git'],
  experience: 'beginner',
  location: 'Seoul, South Korea',
  verified: false,
  attendanceCount: 1,
  rating: 4.0,
  badges: [],
  joinedAt: new Date('2024-05-01'),
  social: {
    github: 'henry-park',
  },
};

const unverifiedAttendee: Attendee = {
  ...mockAttendee,
  id: '9',
  name: 'Unknown User',
  verified: false,
  rating: 3.5,
};

/**
 * Default card with advanced experience
 */
export const Default: Story = {
  args: {
    attendee: mockAttendee,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Expert level attendee with full profile
 */
export const Expert: Story = {
  args: {
    attendee: expertAttendee,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Beginner level attendee
 */
export const Beginner: Story = {
  args: {
    attendee: beginnerAttendee,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Unverified attendee
 */
export const Unverified: Story = {
  args: {
    attendee: unverifiedAttendee,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * With callbacks
 */
export const WithCallbacks: Story = {
  args: {
    attendee: mockAttendee,
    onConnect: (id) => {
      alert(`Connect with: ${id}`);
    },
    onView: (id) => {
      alert(`View profile: ${id}`);
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Minimal information
 */
export const Minimal: Story = {
  args: {
    attendee: {
      id: '10',
      name: 'John Doe',
      title: undefined,
      bio: undefined,
      avatar: undefined,
      interests: [],
      skills: [],
      experience: undefined,
      location: undefined,
      verified: false,
      attendanceCount: 0,
      rating: 3,
      badges: [],
      joinedAt: new Date(),
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Grid layout with multiple cards
 */
export const Grid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 360px)', gap: '1.5rem' }}>
      <AttendeeProfileCard attendee={mockAttendee} />
      <AttendeeProfileCard attendee={expertAttendee} />
      <AttendeeProfileCard attendee={beginnerAttendee} />
    </div>
  ),
};
