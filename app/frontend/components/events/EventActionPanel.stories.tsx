import type { Meta, StoryObj } from '@storybook/react';
import type { Event } from '@/lib/api/events';
import { EventActionPanel } from './EventActionPanel';

const futureStart = new Date(Date.now() + 86400000 * 7).toISOString();
const futureEnd = new Date(Date.now() + 86400000 * 7 + 3600000 * 3).toISOString();
const pastEnd = new Date(Date.now() - 86400000).toISOString();

const baseEvent: Pick<
  Event,
  'id' | 'title' | 'startDate' | 'endDate' | 'location' | 'capacity' | 'registeredCount'
> = {
  id: 'evt-1',
  title: 'Stellar Community Meetup',
  startDate: futureStart,
  endDate: futureEnd,
  location: 'Austin, TX',
  capacity: 120,
  registeredCount: 45,
};

const meta = {
  title: 'Events/EventActionPanel',
  component: EventActionPanel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md bg-gray-50 p-4 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
  args: {
    event: baseEvent,
    shareUrl: 'https://gatherraa.example/events/evt-1',
    bookmarkPersistent: false,
  },
} satisfies Meta<typeof EventActionPanel>;

export default meta;

type Story = StoryObj<typeof EventActionPanel>;

export const CanRegister: Story = {
  args: {
    user: { isAuthenticated: true, isRegistered: false },
  },
};

export const Guest: Story = {
  args: {
    user: { isAuthenticated: false, isRegistered: false },
    signInHref: '/events',
    signInLabel: 'Go to events hub',
  },
};

export const Registered: Story = {
  args: {
    user: { isAuthenticated: true, isRegistered: true },
  },
};

export const Organizer: Story = {
  args: {
    user: { isAuthenticated: true, isRegistered: false, isOrganizer: true },
  },
};

export const EventEnded: Story = {
  args: {
    event: {
      ...baseEvent,
      startDate: pastEnd,
      endDate: pastEnd,
    },
    user: { isAuthenticated: true, isRegistered: false },
  },
};

export const SoldOut: Story = {
  args: {
    event: {
      ...baseEvent,
      capacity: 50,
      registeredCount: 50,
    },
    user: { isAuthenticated: true, isRegistered: false },
  },
};
