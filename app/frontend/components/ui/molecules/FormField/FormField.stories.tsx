import type { Meta, StoryObj } from '@storybook/react';
import { FormField } from './FormField';

const meta: Meta<typeof FormField> = {
  title: 'Design System/Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    required: { control: 'boolean' },
    error: { control: 'text' },
    hint: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  args: {
    label: 'Email',
    name: 'email',
    inputProps: {
      type: 'email',
      placeholder: 'you@example.com',
    },
  },
};

export const Required: Story = {
  args: {
    label: 'Username',
    name: 'username',
    required: true,
    inputProps: {
      placeholder: 'Enter username',
    },
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    name: 'password',
    required: true,
    error: 'Password must be at least 8 characters',
    inputProps: {
      type: 'password',
      placeholder: 'Enter password',
    },
  },
};

export const WithHint: Story = {
  args: {
    label: 'Display name',
    name: 'displayName',
    hint: 'This will be visible to other users.',
    inputProps: {
      placeholder: 'Your name',
    },
  },
};
