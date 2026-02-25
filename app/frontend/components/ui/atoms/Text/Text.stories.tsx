import type { Meta, StoryObj } from '@storybook/react';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Design System/Atoms/Text',
  component: Text,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['body', 'caption', 'label', 'heading-sm', 'heading-md', 'heading-lg'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'muted', 'inverse'],
    },
    as: {
      control: 'select',
      options: ['p', 'span', 'div', 'label', 'h1', 'h2', 'h3'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Text>;

export const Body: Story = {
  args: {
    variant: 'body',
    children: 'Body text for paragraphs and general content.',
  },
};

export const Caption: Story = {
  args: {
    variant: 'caption',
    children: 'Caption or secondary information.',
  },
};

export const Label: Story = {
  args: {
    variant: 'label',
    children: 'Form label',
  },
};

export const HeadingSmall: Story = {
  args: {
    variant: 'heading-sm',
    as: 'h3',
    children: 'Heading small',
  },
};

export const HeadingMedium: Story = {
  args: {
    variant: 'heading-md',
    as: 'h2',
    children: 'Heading medium',
  },
};

export const HeadingLarge: Story = {
  args: {
    variant: 'heading-lg',
    as: 'h1',
    children: 'Heading large',
  },
};

export const Colors: Story = {
  render: () => (
    <div className="space-y-2">
      <Text color="primary">Primary text</Text>
      <Text color="secondary">Secondary text</Text>
      <Text color="muted">Muted text</Text>
    </div>
  ),
};
