import NotificationBell from './NotificationBell';
import type { Notification } from '@/types/notifications';

type Meta = any;
type StoryObj = any;

const meta = {
  title: 'Components/NotificationBell',
  component: NotificationBell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A notification bell component that displays unread notifications in a dropdown menu.',
      },
    },
  },
  tags: ['autodocs'],
} as Meta;

export default meta;
type Story = StoryObj;

// Mock notifications
const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Payment Received',
    message: 'You received a payment of $50.00 for ticket sales',
    type: 'success',
    timestamp: new Date(Date.now() - 5 * 60000),
    isRead: false,
  },
  {
    id: '2',
    title: 'Event Starting Soon',
    message: 'Your event "Tech Conference 2026" starts in 2 hours',
    type: 'warning',
    timestamp: new Date(Date.now() - 30 * 60000),
    isRead: false,
  },
  {
    id: '3',
    title: 'New Review',
    message: 'Sarah left a 5-star review on your event',
    type: 'info',
    timestamp: new Date(Date.now() - 2 * 60 * 60000),
    isRead: true,
  },
  {
    id: '4',
    title: 'Low Ticket Inventory',
    message: 'Only 10 tickets remaining for "Summer Festival"',
    type: 'error',
    timestamp: new Date(Date.now() - 24 * 60 * 60000),
    isRead: true,
  },
];

/**
 * Default state with unread and read notifications
 */
export const Default: Story = {
  args: {
    notifications: mockNotifications,
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * Notification bell with no notifications
 */
export const Empty: Story = {
  args: {
    notifications: [],
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * All notifications unread
 */
export const AllUnread: Story = {
  args: {
    notifications: mockNotifications.map((n) => ({ ...n, isRead: false })),
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * All notifications read
 */
export const AllRead: Story = {
  args: {
    notifications: mockNotifications.map((n) => ({ ...n, isRead: true })),
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * Single notification
 */
export const SingleNotification: Story = {
  args: {
    notifications: [mockNotifications[0]],
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * Many notifications (tests scrolling)
 */
export const ManyNotifications: Story = {
  args: {
    notifications: Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      title: `Notification ${i + 1}`,
      message: `This is notification number ${i + 1}`,
      type: ['info', 'success', 'warning', 'error'][i % 4] as Notification['type'],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60000),
      isRead: i % 2 === 0,
    })),
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
    maxDisplayCount: 10,
  },
} as Story;

/**
 * Different notification types
 */
export const DifferentTypes: Story = {
  args: {
    notifications: [
      {
        id: '1',
        title: 'Success Notification',
        message: 'This is a success message',
        type: 'success',
        timestamp: new Date(),
        isRead: false,
      },
      {
        id: '2',
        title: 'Info Notification',
        message: 'This is an info message',
        type: 'info',
        timestamp: new Date(Date.now() - 1000 * 60),
        isRead: false,
      },
      {
        id: '3',
        title: 'Warning Notification',
        message: 'This is a warning message',
        type: 'warning',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        isRead: false,
      },
      {
        id: '4',
        title: 'Error Notification',
        message: 'This is an error message',
        type: 'error',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        isRead: false,
      },
    ],
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * Large unread count
 */
export const LargeUnreadCount: Story = {
  args: {
    notifications: Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      title: `Notification ${i + 1}`,
      message: `This is notification number ${i + 1}`,
      type: 'info' as const,
      timestamp: new Date(),
      isRead: i > 100, // First 100 are unread
    })),
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
    maxDisplayCount: 10,
  },
} as Story;

/**
 * With various timestamp ages
 */
export const VariousTimestamps: Story = {
  args: {
    notifications: [
      {
        id: '1',
        title: 'Just Now',
        message: 'Happened a few seconds ago',
        type: 'info',
        timestamp: new Date(Date.now() - 30000), // 30 seconds ago
        isRead: false,
      },
      {
        id: '2',
        title: 'Minutes Ago',
        message: 'Happened 5 minutes ago',
        type: 'success',
        timestamp: new Date(Date.now() - 5 * 60000),
        isRead: false,
      },
      {
        id: '3',
        title: 'Hours Ago',
        message: 'Happened 3 hours ago',
        type: 'warning',
        timestamp: new Date(Date.now() - 3 * 60 * 60000),
        isRead: true,
      },
      {
        id: '4',
        title: 'Days Ago',
        message: 'Happened 2 days ago',
        type: 'error',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60000),
        isRead: true,
      },
    ],
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
  },
} as Story;

/**
 * Minimal - No callbacks (for UI testing)
 */
export const NoCallbacks: Story = {
  args: {
    notifications: mockNotifications,
  },
};

/**
 * Custom max display count
 */
export const CustomMaxDisplayCount: Story = {
  args: {
    notifications: mockNotifications,
    onMarkAsRead: (id: string) => console.log('Mark as read:', id),
    onDismiss: (id: string) => console.log('Dismiss:', id),
    maxDisplayCount: 3,
  },
} as Story;
