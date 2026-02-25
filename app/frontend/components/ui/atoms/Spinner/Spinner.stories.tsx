import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Design System/Atoms/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    tone: { control: 'select', options: ['primary', 'neutral', 'inverse'] },
    thickness: { control: 'select', options: ['thin', 'regular', 'thick'] },
    speedMs: { control: { type: 'number', min: 300, max: 2000, step: 100 } },
    label: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {
    size: 'md',
    tone: 'primary',
    speedMs: 800,
  },
};

export const WithLabel: Story = {
  args: {
    size: 'lg',
    tone: 'neutral',
    label: 'Loading data',
  },
};

export const Inverse: Story = {
  args: {
    size: 'lg',
    tone: 'inverse',
    label: 'Loading in hero',
  },
  decorators: [
    (StoryComponent) => (
      <div className="p-6 rounded-xl bg-[var(--gray-900)]">
        <StoryComponent />
      </div>
    ),
  ],
};
