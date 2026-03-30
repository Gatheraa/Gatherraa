import type { Meta, StoryObj } from '@storybook/react';
import { RegistrationGuard, createWalletRule, createCapacityRule, createExpirationRule } from './RegistrationGuard';
import { Button } from '../../atoms';

const meta = {
  title: 'Molecules/RegistrationGuard',
  component: RegistrationGuard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RegistrationGuard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────────────────

export const AllRulesValid: Story = {
  args: {
    rules: [
      createWalletRule(true),
      createCapacityRule(50, 100),
      createExpirationRule(new Date(Date.now() + 86400000)), // Tomorrow
    ],
    children: (
      <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          Registration Available!
        </h3>
        <Button variant="primary">Register Now</Button>
      </div>
    ),
  },
};

export const WalletNotConnected: Story = {
  args: {
    rules: [
      createWalletRule(false),
      createCapacityRule(50, 100),
      createExpirationRule(new Date(Date.now() + 86400000)),
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
  },
};

export const EventFull: Story = {
  args: {
    rules: [
      createWalletRule(true),
      createCapacityRule(100, 100), // Full capacity
      createExpirationRule(new Date(Date.now() + 86400000)),
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
  },
};

export const RegistrationExpired: Story = {
  args: {
    rules: [
      createWalletRule(true),
      createCapacityRule(50, 100),
      createExpirationRule(new Date(Date.now() - 86400000)), // Yesterday
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
  },
};

export const MultipleIssues: Story = {
  args: {
    rules: [
      createWalletRule(false),
      createCapacityRule(100, 100), // Full capacity
      createExpirationRule(new Date(Date.now() - 86400000)), // Expired
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
  },
};

export const CustomFallback: Story = {
  args: {
    rules: [
      createWalletRule(false),
      createCapacityRule(50, 100),
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
    fallback: (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-red-800 dark:text-red-200 font-medium">
          Custom fallback: Registration is currently unavailable
        </p>
      </div>
    ),
  },
};

export const HideRuleDetails: Story = {
  args: {
    rules: [
      createWalletRule(false),
      createCapacityRule(100, 100),
    ],
    children: (
      <Button variant="primary">Register Now</Button>
    ),
    showRuleDetails: false,
  },
};
