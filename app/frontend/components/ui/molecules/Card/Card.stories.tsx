import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import { Button } from '@/components/ui/atoms/Button';
import { Text } from '@/components/ui/atoms/Text';

const meta: Meta<typeof Card> = {
  title: 'Design System/Molecules/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Card>;

export const Simple: Story = {
  args: {
    title: 'Card title',
    children: (
      <>
        <CardContent>
          <Text variant="body" color="secondary">
            Card body content goes here.
          </Text>
        </CardContent>
      </>
    ),
  },
};

export const WithHeaderAndFooter: Story = {
  render: () => (
    <Card title="Proposal" titleAs="h2">
      <CardHeader>
        <Text variant="heading-sm">Proposal Title</Text>
        <Text variant="caption" color="muted">
          Created 2 days ago
        </Text>
      </CardHeader>
      <CardContent>
        <Text variant="body" color="secondary">
          Description and details of the proposal. This is example content for
          the card body.
        </Text>
      </CardContent>
      <CardFooter>
        <div className="flex gap-2">
          <Button variant="primary" size="sm">
            View
          </Button>
          <Button variant="secondary" size="sm">
            Cancel
          </Button>
        </div>
      </CardFooter>
    </Card>
  ),
};

export const WithoutTitle: Story = {
  render: () => (
    <Card>
      <CardContent>
        <Text variant="body">Card without a visible title (use for decorative cards).</Text>
      </CardContent>
    </Card>
  ),
};
