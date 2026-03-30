import type { Meta, StoryObj } from '@storybook/react';
import type { Event } from '@/lib/api/events';
import { EventRecommendationCarousel } from './EventRecommendationCarousel';

const baseEvent = (overrides: Partial<Event>): Event => ({
  id: '1',
  title: 'Sample event',
  description: 'A short description for the card body.',
  type: 'conference',
  category: 'tech',
  startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
  endDate: new Date(Date.now() + 86400000 * 3 + 3600000 * 4).toISOString(),
  location: 'San Francisco, CA',
  organizerId: 'org-1',
  organizerName: 'Gatheraa',
  price: 0,
  capacity: 200,
  isFeatured: true,
  registeredCount: 42,
  attendanceCount: 0,
  status: 'published',
  isPublic: true,
  isDeleted: false,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  statistics: { avgRating: 4.6 },
  ...overrides,
});

const mockEvents: Event[] = [
  baseEvent({
    id: 'e1',
    title: 'Stellar Builders Summit',
    description: 'Workshops and keynotes for Soroban developers.',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=640&q=80',
  }),
  baseEvent({
    id: 'e2',
    title: 'DAO Governance Deep Dive',
    description: 'Proposal lifecycle, voting, and treasury best practices.',
    category: 'governance',
    registeredCount: 128,
    statistics: { avgRating: 4.9 },
  }),
  baseEvent({
    id: 'e3',
    title: 'Web3 UX & Accessibility',
    description: 'Design patterns that work for everyone.',
    startDate: new Date(Date.now() + 86400000 * 14).toISOString(),
    imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=640&q=80',
  }),
  baseEvent({
    id: 'e4',
    title: 'Community Meetup — Berlin',
    description: 'Networking and lightning talks.',
    location: 'Berlin, Germany',
    registeredCount: 0,
    statistics: undefined,
  }),
];

const meta = {
  title: 'Events/EventRecommendationCarousel',
  component: EventRecommendationCarousel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-gray-50 p-6 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventRecommendationCarousel>;

export default meta;

type Story = StoryObj<typeof EventRecommendationCarousel>;

export const Default: Story = {
  args: {
    events: mockEvents,
    title: 'Similar events',
    showControls: true,
    autoplay: false,
  },
};

export const Autoplay: Story = {
  args: {
    events: mockEvents,
    title: 'Trending now',
    autoplay: true,
    autoplayIntervalMs: 3500,
    showControls: true,
  },
};

export const Empty: Story = {
  args: {
    events: [],
    title: 'Recommendations',
    emptyMessage: 'No events to suggest yet.',
  },
};
