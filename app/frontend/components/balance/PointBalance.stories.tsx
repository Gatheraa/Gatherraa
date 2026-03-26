import PointBalance from './PointBalance';
import type { PointBalance as PointBalanceType } from '@/types/pointBalance';

type Meta = any;
type StoryObj = any;

const meta = {
  title: 'Components/PointBalance',
  component: PointBalance,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A balance widget component that displays user point/token balance with real-time updates and tooltip support.',
      },
    },
  },
  tags: ['autodocs'],
} as Meta;

export default meta;
type Story = StoryObj;

// Mock balance data
const mockBalance: PointBalanceType = {
  id: 'balance-1',
  userId: 'user-123',
  totalBalance: 5250.75,
  availableBalance: 5000.00,
  lockedBalance: 200.00,
  pendingBalance: 50.75,
  currency: 'PTS',
  decimals: 2,
  lastUpdated: new Date(),
  percentageChange: 5.2,
};

const mockBalanceNegative: PointBalanceType = {
  ...mockBalance,
  percentageChange: -3.5,
};

const mockBalanceHighBalance: PointBalanceType = {
  ...mockBalance,
  totalBalance: 1000000.00,
  availableBalance: 999500.00,
  lockedBalance: 500.00,
  percentageChange: 12.5,
};

// Compact Variant Stories

export const CompactDefault: Story = {
  args: {
    balance: 5250.75,
    variant: 'compact',
    currency: 'PTS',
    showCurrency: true,
  },
} as Story;

export const CompactWithoutCurrency: Story = {
  args: {
    balance: 5250.75,
    variant: 'compact',
    showCurrency: false,
  },
} as Story;

export const CompactWithFullBalance: Story = {
  args: {
    fullBalance: mockBalance,
    variant: 'compact',
    onRefresh: () => console.log('Refresh clicked'),
  },
} as Story;

export const CompactPositiveTrend: Story = {
  args: {
    fullBalance: mockBalance,
    variant: 'compact',
  },
} as Story;

export const CompactNegativeTrend: Story = {
  args: {
    fullBalance: mockBalanceNegative,
    variant: 'compact',
  },
} as Story;

export const CompactNoTrend: Story = {
  args: {
    balance: 5250.75,
    variant: 'compact',
  },
} as Story;

export const CompactWithTooltip: Story = {
  args: {
    balance: 5250.75,
    variant: 'compact',
    tooltip: 'Your total available points',
  },
} as Story;

// Detailed Variant Stories

export const DetailedDefault: Story = {
  args: {
    fullBalance: mockBalance,
    variant: 'detailed',
  },
} as Story;

export const DetailedWithRefresh: Story = {
  args: {
    fullBalance: mockBalance,
    variant: 'detailed',
    onRefresh: () => console.log('Refreshing...'),
  },
} as Story;

export const DetailedHighBalance: Story = {
  args: {
    fullBalance: mockBalanceHighBalance,
    variant: 'detailed',
  },
} as Story;

export const DetailedNegativeTrend: Story = {
  args: {
    fullBalance: mockBalanceNegative,
    variant: 'detailed',
  },
} as Story;

// Loading States

export const CompactLoading: Story = {
  args: {
    isLoading: true,
    variant: 'compact',
  },
} as Story;

export const DetailedLoading: Story = {
  args: {
    isLoading: true,
    variant: 'detailed',
  },
} as Story;

// Error States

export const CompactError: Story = {
  args: {
    error: 'Failed to fetch balance',
    variant: 'compact',
    onRefresh: () => console.log('Retrying...'),
  },
} as Story;

export const DetailedError: Story = {
  args: {
    error: 'Network error: Could not connect to balance API',
    variant: 'detailed',
    onRefresh: () => console.log('Retrying...'),
  },
} as Story;

// Empty State

export const NoBalance: Story = {
  args: {
    balance: null,
    variant: 'compact',
  },
} as Story;

// Custom Styling

export const CompactWithCustomStyling: Story = {
  args: {
    balance: 5250.75,
    variant: 'compact',
    className: 'p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200',
  },
} as Story;

export const DetailedCompact: Story = {
  args: {
    fullBalance: {
      ...mockBalance,
      lockedBalance: 0,
      pendingBalance: 0,
    },
    variant: 'detailed',
  },
} as Story;

// Different Currencies

export const USDCurrency: Story = {
  args: {
    balance: 1234.56,
    variant: 'compact',
    currency: 'USD',
    decimals: 2,
  },
} as Story;

export const CryptoCurrency: Story = {
  args: {
    balance: 1.5231,
    variant: 'compact',
    currency: 'BTC',
    decimals: 4,
  },
} as Story;

// Interactive Demo

export const Interactive: Story = {
  args: {
    fullBalance: mockBalance,
    variant: 'compact',
    onRefresh: () => console.log('Balance refreshed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example with refresh functionality. Click the lightning bolt icon to refresh.',
      },
    },
  },
} as Story;
