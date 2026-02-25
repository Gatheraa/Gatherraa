import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Design System/Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'success', 'warning', 'error', 'info'] },
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: 'Draft', variant: 'default' } };
export const Success: Story = { args: { children: 'Passed', variant: 'success' } };
export const Info: Story = { args: { children: 'Active', variant: 'info' } };
