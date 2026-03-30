import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TagSelector } from './TagSelector';

const meta: Meta<typeof TagSelector> = {
  title: 'UI/Atoms/TagSelector',
  component: TagSelector,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const DEFAULT_SUGGESTIONS = [
  'Web3',
  'Stellar',
  'Hackathon',
  'Networking',
  'Workshop',
  'Community',
  'Technology',
  'Startup',
];

export const Default: Story = {
  render: (args) => {
    const [tags, setTags] = useState<string[]>(['Stellar']);

    return (
      <div className="w-[520px]">
        <TagSelector
          {...args}
          value={tags}
          onChange={setTags}
        />
      </div>
    );
  },
  args: {
    label: 'Event Tags',
    suggestions: DEFAULT_SUGGESTIONS,
    hint: 'Press Enter to add. Use Backspace to remove the last tag.',
  },
};

export const WithError: Story = {
  render: (args) => {
    const [tags, setTags] = useState<string[]>([]);

    return (
      <div className="w-[520px]">
        <TagSelector
          {...args}
          value={tags}
          onChange={setTags}
          error={{ message: 'At least one tag is required' }}
        />
      </div>
    );
  },
  args: {
    label: 'Event Tags',
    suggestions: DEFAULT_SUGGESTIONS,
  },
};
