# PointBalance Component

A production-ready React component for displaying user point or token balance with real-time updates, balance breakdown, and tooltip support.

## Features

- 💰 Display balance with formatting and currency
- 📊 Show balance breakdown (available, locked, pending)
- 🔄 Real-time auto-refresh with configurable polling
- 📈 Percentage change indicator (trending up/down)
- 🎯 Two display variants: compact and detailed
- 🌐 Tooltip with balance information
- 📈 Loading and error state handling
- ♿ Full accessibility support
- 🎨 Responsive design with customizable styling

## Installation

The component is integrated into the project at:
```
app/frontend/components/balance/PointBalance.tsx
```

## Props

### PointBalanceProps

```typescript
interface PointBalanceProps {
  balance?: number | null;                    // Simple balance number
  fullBalance?: PointBalance;                 // Complete balance object
  isLoading?: boolean;                        // Show loading state
  error?: string | null;                      // Error message
  onRefresh?: () => void;                     // Refresh callback
  autoRefresh?: boolean;                      // Enable auto-refresh
  refreshInterval?: number;                   // Polling interval (ms)
  showCurrency?: boolean;                     // Show currency symbol
  currency?: string;                          // Currency code/symbol
  decimals?: number;                          // Decimal places
  variant?: 'compact' | 'detailed';           // Display variant
  tooltip?: string;                           // Tooltip text
  className?: string;                         // Custom CSS classes
}
```

### PointBalance Interface

```typescript
interface PointBalance {
  id: string;                                 // Unique identifier
  userId: string;                             // User ID
  totalBalance: number;                       // Total balance
  availableBalance: number;                   // Available balance
  lockedBalance: number;                      // Locked balance
  pendingBalance: number;                     // Pending balance
  currency?: string;                          // Currency code
  decimals?: number;                          // Decimal places
  lastUpdated: Date | string;                 // Last update time
  percentageChange?: number;                  // Change percentage
}
```

## Usage

### Simple Compact Display

```typescript
import PointBalance from '@/components/balance/PointBalance';

export default function MyComponent() {
  return (
    <PointBalance
      balance={5250.75}
      variant="compact"
      currency="PTS"
      showCurrency={true}
    />
  );
}
```

### With Hook for Auto-Updates

```typescript
import PointBalance from '@/components/balance/PointBalance';
import { usePointBalance } from '@/hooks/usePointBalance';

export default function MyComponent() {
  const { balance, isLoading, error, refresh } = usePointBalance({
    autoFetch: true,
    pollInterval: 30000, // Update every 30 seconds
  });

  return (
    <PointBalance
      fullBalance={balance}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      variant="detailed"
    />
  );
}
```

### Detailed Variant with Breakdown

```typescript
<PointBalance
  fullBalance={{
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
  }}
  variant="detailed"
  onRefresh={() => console.log('Refreshing...')}
/>
```

### With Custom Styling

```typescript
<PointBalance
  balance={5250.75}
  variant="compact"
  className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded"
/>
```

## Components

### Compact Variant
Shows balance with optional currency, percentage change, tooltip, and refresh button.

```
5,250.75 PTS +5.2% [?] [⚡]
```

### Detailed Variant
Shows balance breakdown with expandable sections for available, locked, and pending amounts.

```
┌─────────────────────────────┐
│ PointBalance         [⚡]    │
│                             │
│ Total Balance               │
│ 5,250.75 PTS +5.2%          │
│                             │
│ ▶ Balance Breakdown         │
│                             │
│ Last updated: 10:30:45 AM   │
└─────────────────────────────┘
```

## Hooks

### usePointBalance

Manages balance state and fetching with optional auto-polling.

```typescript
const { balance, isLoading, error, refresh, updateBalance } = usePointBalance({
  autoFetch: true,
  pollInterval: 30000,
  userId: 'current',
});

// Manual refresh
await refresh();

// Update balance locally
updateBalance({ availableBalance: 5100 });
```

## API Integration

The component expects these API endpoints:

### GET /api/points/balance
Fetch user's point balance

**Query Parameters:**
- `userId` (string) - User ID or "current"

**Response:**
```json
{
  "success": true,
  "balance": {
    "id": "balance-1",
    "userId": "user-123",
    "totalBalance": 5250.75,
    "availableBalance": 5000.00,
    "lockedBalance": 200.00,
    "pendingBalance": 50.75,
    "currency": "PTS",
    "decimals": 2,
    "lastUpdated": "2024-03-26T10:30:00Z",
    "percentageChange": 5.2
  },
  "timestamp": "2024-03-26T10:30:45Z"
}
```

## States

### Loading State
Shows animated skeleton while fetching balance data.

### Error State
Displays error message with optional retry button.

```typescript
<PointBalance
  error="Failed to fetch balance"
  onRefresh={() => console.log('Retrying...')}
/>
```

### Empty State
Shows message when no balance data is available.

## Display Variants

### Compact
- Minimal display of balance number
- Shows currency symbol if enabled
- Includes tooltip and refresh button
- Perfect for inline displays, headers, navbars
- Size: ~150px wide

### Detailed
- Full balance breakdown
- Expandable sections
- Shows available, locked, pending amounts
- Last updated timestamp
- Perfect for dashboard, account pages
- Size: ~400px wide

## Styling

### Color Scheme

| Element | Color |
|---------|-------|
| **Available** | Green (bg-green-500) |
| **Locked** | Yellow (bg-yellow-600) |
| **Pending** | Blue (bg-blue-600) |
| **Positive Trend** | Green (text-green-600) |
| **Negative Trend** | Red (text-red-600) |

### Customization

All styling uses Tailwind CSS utility classes. Customize with the `className` prop:

```typescript
<PointBalance
  balance={5250.75}
  className="p-4 bg-blue-50 rounded border border-blue-200"
/>
```

## Events & Callbacks

### onRefresh
Called when user clicks refresh button. Typically triggers API call to fetch latest balance.

```typescript
<PointBalance
  onRefresh={async () => {
    await fetchLatestBalance();
  }}
/>
```

## Accessibility

- ✅ ARIA labels on interactive elements
- ✅ Semantic HTML structure
- ✅ Keyboard navigation support
- ✅ Color-independent indicators (icons + colors)
- ✅ Loading state announcements
- ✅ Error messaging

## Performance

- Component renders efficiently with memo optimization
- Polling only active when `autoRefresh: true`
- No re-renders on tooltip hover
- Minimal DOM updates on state change

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Testing

### Visual Testing (Storybook)

```bash
npm run storybook
# Navigate to Components > PointBalance
```

Available stories:
- Compact Default
- Compact with Trend
- Compact with Tooltip
- Detailed Default
- Detailed Breakdown
- Loading State
- Error State
- No Balance

### Unit Testing

```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/user-event vitest

# Run tests
npm test PointBalance.test.tsx
```

## Related Files

- **Component**: [PointBalance.tsx](PointBalance.tsx)
- **Hook**: [usePointBalance.ts](../../hooks/usePointBalance.ts)
- **Types**: [pointBalance.ts](../../types/pointBalance.ts)
- **Example**: [PointBalanceExample.tsx](PointBalanceExample.tsx)
- **Stories**: [PointBalance.stories.tsx](PointBalance.stories.tsx)
- **Tests**: [PointBalance.test.tsx](PointBalance.test.tsx)

## Version

- Component Version: 1.0.0
- Last Updated: March 26, 2026
- Status: Production Ready
