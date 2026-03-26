import type { Meta, StoryObj } from '@storybook/react';
import { CapacityProgress } from './CapacityProgress';

const meta: Meta<typeof CapacityProgress> = {
  title: 'UI/Molecules/CapacityProgress',
  component: CapacityProgress,
  tags: ['autodocs'],
  argTypes: {
    currentCapacity: { control: 'number' },
    maxCapacity: { control: 'number' },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CapacityProgress>;

export const Default: Story = {
  args: {
    currentCapacity: 45,
    maxCapacity: 100,
  },
};

export const Empty: Story = {
  args: {
    currentCapacity: 0,
    maxCapacity: 100,
  },
};

export const AlmostFull: Story = {
  args: {
    currentCapacity: 95,
    maxCapacity: 100,
  },
};

export const SoldOut: Story = {
  args: {
    currentCapacity: 100,
    maxCapacity: 100,
  },
};

export const OverCapacity: Story = {
  args: {
    currentCapacity: 120,
    maxCapacity: 100,
  },
};
