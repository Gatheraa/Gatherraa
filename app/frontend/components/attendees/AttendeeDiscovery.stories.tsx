import type { Meta, StoryObj } from '@storybook/react';
import { AttendeeDiscovery } from './AttendeeDiscovery';
import type { Attendee } from '@/types/attendee';

const meta: Meta<typeof AttendeeDiscovery> = {
  title: 'Attendees/AttendeeDiscovery',
  component: AttendeeDiscovery,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock attendee data
const mockAttendees: Attendee[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    title: 'Senior Product Manager',
    bio: 'Passionate about building products that solve real problems. Experienced in blockchain and Web3.',
    avatar: undefined,
    interests: ['Web3', 'Product Management', 'Design Thinking'],
    skills: ['Product Strategy', 'User Research', 'Analytics'],
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
  },
  {
    id: '2',
    name: 'Bob Chen',
    title: 'Full Stack Developer',
    bio: 'Building with React, Node.js, and smart contracts. Always learning.',
    avatar: undefined,
    interests: ['Smart Contracts', 'Full Stack Development', 'DevOps'],
    skills: ['TypeScript', 'Solidity', 'Docker'],
    experience: 'expert',
    location: 'Austin, TX',
    verified: true,
    attendanceCount: 24,
    rating: 4.9,
    badges: ['Expert', 'Contributor', 'Mentor'],
    joinedAt: new Date('2022-06-20'),
    website: 'https://bobchen.dev',
    social: {
      twitter: 'bobchen',
      github: 'bob-chen',
    },
  },
  {
    id: '3',
    name: 'Carol Williams',
    title: 'UX Designer',
    bio: 'Creating beautiful and accessible user experiences. Design system enthusiast.',
    avatar: undefined,
    interests: ['User Experience', 'Design Systems', 'Accessibility'],
    skills: ['Figma', 'User Research', 'CSS'],
    experience: 'intermediate',
    location: 'New York, NY',
    verified: true,
    attendanceCount: 8,
    rating: 4.6,
    badges: ['Designer', 'Speaker'],
    joinedAt: new Date('2023-03-10'),
    social: {
      twitter: 'carolwilliams',
    },
  },
  {
    id: '4',
    name: 'David Martinez',
    title: 'Blockchain Analyst',
    bio: 'Analyzing blockchain trends and market dynamics. Data-driven insights.',
    avatar: undefined,
    interests: ['Blockchain', 'DeFi', 'Analytics'],
    skills: ['Data Analysis', 'Blockchain', 'Python'],
    experience: 'intermediate',
    location: 'Miami, FL',
    verified: false,
    attendanceCount: 3,
    rating: 4.2,
    badges: ['Analyst'],
    joinedAt: new Date('2024-01-05'),
    social: {
      twitter: 'davidmartinez',
      linkedin: 'david-martinez',
    },
  },
  {
    id: '5',
    name: 'Emily Zhang',
    title: 'Marketing Manager',
    bio: 'Growth marketer focused on blockchain and crypto communities.',
    avatar: undefined,
    interests: ['Growth Marketing', 'Community Building', 'Content'],
    skills: ['Marketing Strategy', 'Analytics', 'Social Media'],
    experience: 'intermediate',
    location: 'Los Angeles, CA',
    verified: true,
    attendanceCount: 15,
    rating: 4.5,
    badges: ['Growth Expert'],
    joinedAt: new Date('2023-05-12'),
    website: 'https://emilyzhang.com',
    social: {
      twitter: 'emilyzhang',
      linkedin: 'emily-zhang',
    },
  },
  {
    id: '6',
    name: 'Frank Thompson',
    title: 'Security Engineer',
    bio: 'Smart contract auditor and security researcher.',
    avatar: undefined,
    interests: ['Security', 'Smart Contracts', 'Cryptography'],
    skills: ['Security Auditing', 'Solidity', 'Penetration Testing'],
    experience: 'expert',
    location: 'Boston, MA',
    verified: true,
    attendanceCount: 18,
    rating: 4.9,
    badges: ['Security Expert', 'Auditor'],
    joinedAt: new Date('2022-10-08'),
    website: 'https://frank-security.io',
    social: {
      twitter: 'frankthompson',
      github: 'frank-thompson',
    },
  },
  {
    id: '7',
    name: 'Grace Lee',
    title: 'Business Developer',
    bio: 'Partnership & business development in Web3 startups.',
    avatar: undefined,
    interests: ['Business Development', 'Partnerships', 'Startups'],
    skills: ['Business Strategy', 'Negotiation', 'Networking'],
    experience: 'advanced',
    location: 'Singapore',
    verified: true,
    attendanceCount: 10,
    rating: 4.7,
    badges: ['BD Expert'],
    joinedAt: new Date('2023-02-20'),
    social: {
      linkedin: 'grace-lee',
    },
  },
  {
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
  },
];

/**
 * Default view of the Attendee Discovery interface with sample data
 */
export const Default: Story = {
  args: {
    attendees: mockAttendees,
    loading: false,
    defaultPageSize: 12,
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    attendees: [],
    loading: true,
  },
};

/**
 * Empty state
 */
export const Empty: Story = {
  args: {
    attendees: [],
    loading: false,
    emptyMessage: 'No attendees found. Try adjusting your search or filters.',
  },
};

/**
 * With callbacks
 */
export const WithCallbacks: Story = {
  args: {
    attendees: mockAttendees,
    loading: false,
    onConnect: (id) => {
      alert(`Connected with attendee: ${id}`);
    },
    onViewProfile: (id) => {
      alert(`Viewing profile for attendee: ${id}`);
    },
    onSearch: (query) => {
      console.log('Search query:', query);
    },
    onFiltersChange: (filters) => {
      console.log('Filters changed:', filters);
    },
  },
};

/**
 * With page size selector
 */
export const WithPageSizeSelector: Story = {
  args: {
    attendees: mockAttendees,
    loading: false,
    defaultPageSize: 6,
    showPageSizeSelector: true,
    pageSizeOptions: [6, 12, 24],
  },
};

/**
 * Small dataset
 */
export const SmallDataset: Story = {
  args: {
    attendees: mockAttendees.slice(0, 3),
    loading: false,
  },
};

/**
 * Large dataset with pagination
 */
export const LargeDataset: Story = {
  args: {
    attendees: Array.from({ length: 100 }, (_, i) => ({
      ...mockAttendees[i % mockAttendees.length],
      id: `attendee-${i + 1}`,
      name: `${mockAttendees[i % mockAttendees.length].name} ${i + 1}`,
    })),
    loading: false,
    defaultPageSize: 12,
  },
};

/**
 * Custom search placeholder
 */
export const CustomSearchPlaceholder: Story = {
  args: {
    attendees: mockAttendees,
    loading: false,
    searchPlaceholder: 'Find experts, skills, or interests...',
  },
};
