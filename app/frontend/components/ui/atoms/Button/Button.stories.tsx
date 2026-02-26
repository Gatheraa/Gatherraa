import type { Meta, StoryObj } from '@storybook/react';
import { Plus } from 'lucide-react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Design System/Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'outline', 'icon'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    ripple: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: 'Connect Wallet', variant: 'primary' } };
export const Secondary: Story = { args: { children: 'Cancel', variant: 'secondary' } };
export const FullWidth: Story = { args: { children: 'Full width', fullWidth: true } };
export const Outline: Story = { args: { children: 'Outline button', variant: 'outline' } };
export const Icon: Story = {
  args: {
    variant: 'icon',
    size: 'md',
    leftIcon: <Plus className="w-full h-full" />,
    'aria-label': 'Add item',
  },
};
