import type { Meta, StoryObj } from '@storybook/react';
import { TransactionStatusTracker } from './TransactionStatusTracker';

const meta: Meta<typeof TransactionStatusTracker> = {
  title: 'TransactionStatus/TransactionStatusTracker',
  component: TransactionStatusTracker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    txHash: {
      control: 'text',
      description: 'Transaction hash to track',
    },
    pollingInterval: {
      control: 'number',
      description: 'Polling interval in milliseconds',
    },
    timeout: {
      control: 'number',
      description: 'Timeout in milliseconds',
    },
    explorerUrl: {
      control: 'text',
      description: 'Blockchain explorer URL',
    },
    useWebSocket: {
      control: 'boolean',
      description: 'Use WebSocket for real-time updates',
    },
    showHash: {
      control: 'boolean',
      description: 'Show transaction hash',
    },
    showTimestamp: {
      control: 'boolean',
      description: 'Show timestamp',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock provider for demo purposes
const mockProvider = {
  getTransactionReceipt: async (hash: string) => {
    // Simulate different scenarios based on hash
    if (hash.includes('pending')) {
      return null; // Still pending
    } else if (hash.includes('confirmed')) {
      return {
        status: 1,
        blockNumber: 12345,
        gasUsed: { toString: () => '21000' },
        confirmations: 12,
      };
    } else if (hash.includes('failed')) {
      return {
        status: 0,
        blockNumber: 12345,
        gasUsed: { toString: () => '21000' },
        confirmations: 0,
      };
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return null;
  },
};

export const Pending: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_pending',
    provider: mockProvider,
    pollingInterval: 2000,
    timeout: 30000,
    explorerUrl: 'https://etherscan.io/tx',
    showHash: true,
    showTimestamp: true,
  },
};

export const Confirmed: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_confirmed',
    provider: mockProvider,
    pollingInterval: 2000,
    timeout: 30000,
    explorerUrl: 'https://etherscan.io/tx',
    showHash: true,
    showTimestamp: true,
  },
};

export const Failed: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_failed',
    provider: mockProvider,
    pollingInterval: 2000,
    timeout: 30000,
    explorerUrl: 'https://etherscan.io/tx',
    showHash: true,
    showTimestamp: true,
  },
};

export const Minimal: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    provider: mockProvider,
    pollingInterval: 5000,
    showHash: false,
    showTimestamp: false,
    labels: {
      pending: 'Processing...',
      confirmed: 'Complete',
      failed: 'Error',
    },
  },
};

export const WithWebSocket: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    provider: mockProvider,
    useWebSocket: true,
    websocketUrl: 'wss://localhost:8546',
    pollingInterval: 5000,
    timeout: 60000,
    explorerUrl: 'https://etherscan.io/tx',
  },
};

export const CustomLabels: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    provider: mockProvider,
    pollingInterval: 3000,
    timeout: 45000,
    explorerUrl: 'https://etherscan.io/tx',
    labels: {
      pending: '⏳ Waiting for confirmation',
      confirmed: '✅ Transaction successful',
      failed: '❌ Transaction failed',
      timeout: '⏰ Transaction timed out',
    },
  },
};

export const FastPolling: Story = {
  args: {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    provider: mockProvider,
    pollingInterval: 1000, // 1 second
    timeout: 15000, // 15 seconds
    explorerUrl: 'https://etherscan.io/tx',
  },
};
