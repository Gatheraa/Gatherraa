import type { Meta, StoryObj } from '@storybook/react';
import { SkeletonCard, SkeletonPage, SkeletonTable } from './LoadingSkeletons';

const meta: Meta<typeof SkeletonCard> = {
  title: 'Design System/Molecules/LoadingSkeletons',
  component: SkeletonCard,
  tags: ['autodocs'],
  argTypes: {
    lines: { control: { type: 'number', min: 1, max: 6, step: 1 } },
  },
};

export default meta;

type Story = StoryObj<typeof SkeletonCard>;

export const Card: Story = {
  args: {
    lines: 3,
  },
};

export const Table: Story = {
  render: () => <SkeletonTable rows={5} columns={5} />,
};

export const Page: Story = {
  render: () => <SkeletonPage cards={3} />,
};
