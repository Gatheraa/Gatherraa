import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Design System/Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: 'Connect Wallet', variant: 'primary' } };
export const Secondary: Story = { args: { children: 'Cancel', variant: 'secondary' } };
export const FullWidth: Story = { args: { children: 'Full width', fullWidth: true } };
