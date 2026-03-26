import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BookmarkButton } from './BookmarkButton';

const meta: Meta<typeof BookmarkButton> = {
  title: 'UI/Atoms/BookmarkButton',
  component: BookmarkButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A toggle button component for save/unsave events with persistent storage support.'
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Bookmarked: Story = {
  args: {
    isBookmarked: true,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const WithSaveUnsave: Story = {
  args: {
    isBookmarked: false,
    onSave: () => console.log('Saved!'),
    onUnsave: () => console.log('Unsaved!'),
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const PrimaryVariant: Story = {
  args: {
    variant: 'primary',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const GhostVariant: Story = {
  args: {
    variant: 'ghost',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const WithCount: Story = {
  args: {
    showCount: true,
    count: 42,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const WithHighCount: Story = {
  args: {
    showCount: true,
    count: 150,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const WithCustomIcons: Story = {
  args: {
    bookmarkedIcon: <span>⭐</span>,
    unbookmarkedIcon: <span>☆</span>,
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const WithTooltips: Story = {
  args: {
    bookmarkedTooltip: 'Click to remove from bookmarks',
    unbookmarkedTooltip: 'Click to add to bookmarks',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Persistent: Story = {
  args: {
    persistent: true,
    storageKey: 'example-bookmark',
    onBookmarkChange: (bookmarked) => console.log('Bookmark state:', bookmarked),
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSave = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsLoading(false);
    };
    
    const handleUnsave = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsLoading(false);
    };
    
    return (
      <div className="space-y-4">
        <BookmarkButton
          {...args}
          isBookmarked={isBookmarked}
          onBookmarkChange={setIsBookmarked}
          onSave={handleSave}
          onUnsave={handleUnsave}
          loading={isLoading}
        />
        <div className="text-sm text-gray-600">
          Current state: {isBookmarked ? 'Bookmarked' : 'Not bookmarked'}
          {isLoading && ' (Loading...)'}
        </div>
      </div>
    );
  },
  args: {
    showCount: true,
    count: 1,
  },
};
