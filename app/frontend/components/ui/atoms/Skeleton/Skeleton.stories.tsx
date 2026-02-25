import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Design System/Atoms/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['text', 'rectangular', 'rounded', 'circular'] },
    animate: { control: 'boolean' },
    width: { control: 'text' },
    height: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

export const TextLine: Story = {
  args: {
    variant: 'text',
    width: '80%',
  },
};

export const Avatar: Story = {
  args: {
    variant: 'circular',
    width: 56,
    height: 56,
  },
};

export const CardBlock: Story = {
  args: {
    variant: 'rounded',
    height: 180,
  },
};
