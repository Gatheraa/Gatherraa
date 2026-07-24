import type { Meta, StoryObj } from '@storybook/react';
import { Calendar, Home, Settings, User, FileText, Search, Plus, Bell } from 'lucide-react';
import { useState } from 'react';
import { CommandPalette } from './CommandPalette';
import { CommandPaletteProvider } from './CommandPaletteContext';
import { useCommandPalette } from './useCommandPalette';
import type { CommandGroup } from './types';

const sampleGroups: CommandGroup[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    commands: [
      { id: 'home', label: 'Go to Home', icon: <Home className="w-4 h-4" />, shortcut: ['⌘', 'H'], action: () => alert('Home') },
      { id: 'events', label: 'Go to Events', icon: <Calendar className="w-4 h-4" />, shortcut: ['⌘', 'E'], action: () => alert('Events') },
      { id: 'profile', label: 'Go to Profile', icon: <User className="w-4 h-4" />, shortcut: ['⌘', 'P'], action: () => alert('Profile') },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    commands: [
      { id: 'new-event', label: 'Create New Event', icon: <Plus className="w-4 h-4" />, shortcut: ['⌘', 'N'], action: () => alert('New Event'), keywords: ['create', 'add'] },
      { id: 'notifications', label: 'View Notifications', icon: <Bell className="w-4 h-4" />, action: () => alert('Notifications') },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    commands: [
      { id: 'settings', label: 'Open Settings', icon: <Settings className="w-4 h-4" />, shortcut: ['⌘', ','], action: () => alert('Settings') },
    ],
  },
];

const meta: Meta<typeof CommandPalette> = {
  title: 'Design System/Atoms/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof CommandPalette>;

const Wrapper = (args: React.ComponentProps<typeof CommandPalette>) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm"
      >
        Open Command Palette (⌘K)
      </button>
      <CommandPalette {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

export const Default: Story = {
  render: () => <Wrapper groups={sampleGroups} />,
};

export const WithContext: Story = {
  render: () => (
    <CommandPaletteProvider initialGroups={sampleGroups}>
      <ContextDemo />
    </CommandPaletteProvider>
  ),
};

function ContextDemo() {
  const { isOpen, open, close } = useCommandPalette();
  return (
    <div>
      <button
        onClick={open}
        className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm"
      >
        Open Command Palette (⌘K)
      </button>
      <CommandPalette isOpen={isOpen} onClose={close} />
    </div>
  );
}

export const Empty: Story = {
  render: () => <Wrapper groups={[]} emptyMessage="No commands available." />,
};

export const SingleGroup: Story = {
  render: () => (
    <Wrapper
      groups={[
        {
          id: 'search',
          label: 'Search',
          commands: [
            { id: 'search', label: 'Search Events', icon: <Search className="w-4 h-4" />, action: () => alert('Search'), keywords: ['find', 'lookup'] },
            { id: 'docs', label: 'View Documentation', icon: <FileText className="w-4 h-4" />, action: () => alert('Docs'), keywords: ['help', 'read'] },
          ],
        },
      ]}
    />
  ),
};
