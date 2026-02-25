import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Design System/Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    error: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Project name',
    placeholder: 'Name your project',
    defaultValue: 'Gatherraa',
  },
};

export const Error: Story = {
  args: {
    label: 'Password',
    placeholder: 'At least 8 characters',
    error: true,
    defaultValue: 'invalid',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    placeholder: 'Unavailable right now',
    disabled: true,
  },
};

export const FullWidth: Story = {
  args: {
    label: 'Search',
    placeholder: 'Find a mission',
    fullWidth: true,
  },
};
