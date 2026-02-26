import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { InteractiveReaction } from './InteractiveReaction';

const meta: Meta<typeof InteractiveReaction> = {
  title: 'Atoms/InteractiveReaction',
  component: InteractiveReaction,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    reactionType: {
      control: 'select',
      options: ['like', 'love', 'thumbsup', 'comment', 'share', 'bookmark'],
      description: 'Type of reaction to display',
    },
    count: {
      control: 'number',
      description: 'Number of reactions',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the reaction button',
    },
    showCount: {
      control: 'boolean',
      description: 'Whether to show the count',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    isActive: {
      control: 'boolean',
      description: 'Whether the reaction is currently active',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Like: Story = {
  args: {
    reactionType: 'like',
    count: 42,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Love: Story = {
  args: {
    reactionType: 'love',
    count: 128,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const ThumbsUp: Story = {
  args: {
    reactionType: 'thumbsup',
    count: 256,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Comment: Story = {
  args: {
    reactionType: 'comment',
    count: 15,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Share: Story = {
  args: {
    reactionType: 'share',
    count: 8,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Bookmark: Story = {
  args: {
    reactionType: 'bookmark',
    count: 64,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Small: Story = {
  args: {
    reactionType: 'like',
    count: 42,
    size: 'sm',
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Large: Story = {
  args: {
    reactionType: 'love',
    count: 128,
    size: 'lg',
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const NoCount: Story = {
  args: {
    reactionType: 'thumbsup',
    count: 256,
    showCount: false,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Active: Story = {
  args: {
    reactionType: 'like',
    count: 42,
    isActive: true,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const Disabled: Story = {
  args: {
    reactionType: 'comment',
    count: 15,
    disabled: true,
    onReact: (type, isActive) => console.log(`${type} ${isActive ? 'activated' : 'deactivated'}`),
  },
};

export const AllReactions: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <InteractiveReaction reactionType="like" count={42} />
      <InteractiveReaction reactionType="love" count={128} />
      <InteractiveReaction reactionType="thumbsup" count={256} />
      <InteractiveReaction reactionType="comment" count={15} />
      <InteractiveReaction reactionType="share" count={8} />
      <InteractiveReaction reactionType="bookmark" count={64} />
    </div>
  ),
};

export const InteractiveDemo: Story = {
  render: () => {
    const [counts, setCounts] = useState({
      like: 42,
      love: 128,
      thumbsup: 256,
      comment: 15,
      share: 8,
      bookmark: 64,
    });

    const [activeStates, setActiveStates] = useState({
      like: false,
      love: false,
      thumbsup: false,
      comment: false,
      share: false,
      bookmark: false,
    });

    const handleReact = (type: string, isActive: boolean) => {
      setCounts(prev => ({
        ...prev,
        [type]: prev[type as keyof typeof prev] + (isActive ? 1 : -1)
      }));
      setActiveStates(prev => ({
        ...prev,
        [type]: isActive
      }));
    };

    return (
      <div className="space-y-6">
        <div className="flex gap-4 flex-wrap">
          {Object.keys(counts).map((type) => (
            <InteractiveReaction
              key={type}
              reactionType={type as any}
              count={counts[type as keyof typeof counts]}
              isActive={activeStates[type as keyof typeof activeStates]}
              onReact={handleReact}
            />
          ))}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Click any reaction to see the animations and counter updates in action!</p>
          <p className="mt-2">Current counts: {JSON.stringify(counts)}</p>
        </div>
      </div>
    );
  },
};
