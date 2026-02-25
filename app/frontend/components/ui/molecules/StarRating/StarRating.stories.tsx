import type { Meta, StoryObj } from '@storybook/react';
import { StarRating } from './StarRating';

const meta: Meta<typeof StarRating> = {
  title: 'Design System/Molecules/StarRating',
  component: StarRating,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'number', min: 0, max: 5, step: 0.5 } },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    interactive: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof StarRating>;

export const Display: Story = {
  args: {
    value: 4,
    'aria-label': 'Rating: 4 out of 5 stars',
  },
};

export const HalfStar: Story = {
  args: {
    value: 3.5,
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-sm text-[var(--text-muted)] block mb-1">Small</span>
        <StarRating value={4} size="sm" />
      </div>
      <div>
        <span className="text-sm text-[var(--text-muted)] block mb-1">Medium</span>
        <StarRating value={4} size="md" />
      </div>
      <div>
        <span className="text-sm text-[var(--text-muted)] block mb-1">Large</span>
        <StarRating value={4} size="lg" />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    value: 0,
    interactive: true,
    onChange: (v) => console.log('Selected:', v),
    'aria-label': 'Rate from 1 to 5 stars',
  },
};
