# PointBalance Component - Integration Guide

A step-by-step guide to integrate the PointBalance component into your application.

## Prerequisites

- Node.js 18+ with npm
- React 19.2.3 and Next.js 15.3.0 (already in your project)
- Tailwind CSS 4+ (already configured)
- Backend API endpoints for balance management

## Integration Steps

### Step 1: Verify Files Are In Place

Check that all component files exist:

```
app/frontend/
├── components/
│   └── balance/
│       ├── PointBalance.tsx ✓
│       ├── PointBalanceExample.tsx
│       ├── PointBalance.stories.tsx
│       ├── PointBalance.test.tsx
│       ├── POINT_BALANCE_README.md
│       └── SETUP_CHECKLIST.md
├── hooks/
│   └── usePointBalance.ts ✓
└── types/
    └── pointBalance.ts ✓
```

### Step 2: Verify Dependencies

All required dependencies should be in `package.json`. Verify:

```bash
npm list react lucide-react
```

Expected:
- `react@19.2.3`
- `lucide-react@^0.469.0`

If missing:
```bash
npm install react@19.2.3 lucide-react@^0.469.0
```

### Step 3: Choose Integration Point

Decide where to display the balance:

**Option A: User Header/Profile**
```
app/frontend/components/Header.tsx
```

**Option B: Dashboard Widget**
```
app/frontend/components/Dashboard.tsx
```

**Option C: Account Page**
```
app/frontend/app/account/BalanceWidget.tsx
```

### Step 4: Import Component and Hook

Add imports to your component:

```typescript
import PointBalance from '@/components/balance/PointBalance';
import { usePointBalance } from '@/hooks/usePointBalance';
```

### Step 5: Initialize the Hook

Set up the balance management:

```typescript
export default function UserHeader() {
  const { 
    balance, 
    isLoading, 
    error, 
    refresh,
    updateBalance 
  } = usePointBalance({
    autoFetch: true,        // Auto-fetch on mount
    pollInterval: 30000,    // Update every 30 seconds
    userId: 'current',
  });

  // Your component logic...
}
```

### Step 6: Add Component to JSX

Integrate the balance display:

```typescript
export default function UserHeader() {
  const { balance, isLoading, error, refresh } = usePointBalance({
    autoFetch: true,
    pollInterval: 30000,
  });

  return (
    <header className="flex items-center justify-between p-4 bg-white border-b">
      <div>Logo/Title</div>
      
      {/* Add balance here */}
      <PointBalance
        fullBalance={balance}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
        variant="compact"
      />
      
      {/* Other header items */}
      <UserMenu />
    </header>
  );
}
```

### Step 7: Create Backend Endpoints

Implement the balance API in your NestJS backend:

#### GET /api/points/balance

**Backend Code Example:**
```typescript
// app/backend/src/points/points.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PointsService } from './points.service';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('api/points')
@UseGuards(AuthGuard('jwt'))
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  async getBalance(@Query('userId') userId: string, @CurrentUser() authUserId: string) {
    const actualUserId = userId === 'current' ? authUserId : userId;
    
    const balance = await this.pointsService.getBalance(actualUserId);
    
    return {
      success: true,
      balance,
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Expected Response:**
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

### Step 8: Test the Integration

#### Visual Test
```bash
# Start development server
npm run dev

# Application should be running at http://localhost:3000
# You should see balance displayed in your chosen location
```

#### Storybook Test
```bash
# View component examples
npm run storybook

# Visit http://localhost:6006
# Navigate to Components > PointBalance
```

## Configuration Guide

### Auto-Fetch Options

```typescript
// Auto-fetch enabled (recommended)
const { balance } = usePointBalance({
  autoFetch: true,
  pollInterval: 30000, // Update every 30 seconds
});

// Manual fetching only
const { balance, refresh } = usePointBalance({
  autoFetch: false,
});

// Fetch on demand
useEffect(() => {
  refresh();
}, [dependency]);
```

### Display Variants

```typescript
// Minimal compact display (inline, headers)
<PointBalance
  fullBalance={balance}
  variant="compact"
/>

// Detailed with breakdown (dashboard, account page)
<PointBalance
  fullBalance={balance}
  variant="detailed"
/>
```

### Currency Settings

```typescript
// Points
<PointBalance
  balance={5250.75}
  currency="PTS"
  decimals={2}
/>

// Cryptocurrency
<PointBalance
  balance={0.5231}
  currency="BTC"
  decimals={4}
/>

// Fiat Currency
<PointBalance
  balance={1234.56}
  currency="USD"
  decimals={2}
/>
```

## Expected Behavior

### On Load
1. Component mounts and hook initializes
2. If `autoFetch: true`, balance is fetched from API
3. Balance displays with loading state
4. Polling starts at configured interval

### On Click (Compact)
1. Click refresh icon ⚡ to manually refresh
2. API call fetches updated balance
3. Component updates with new data
4. Timestamp updates to current time

### Expansion (Detailed)
1. Click "Balance Breakdown" to expand
2. Shows available, locked, and pending amounts
3. Click again to collapse
4. State persists within component

### Auto-Update
1. Polling timer calls refresh periodically
2. Latest balance is fetched automatically
3. UI updates without user action
4. "Last updated" timestamp changes

## Styling Integration

### Using Default Styles
Component works out of the box with Tailwind CSS already configured.

### Custom Styling

Modify card layout:
```typescript
<PointBalance
  fullBalance={balance}
  variant="detailed"
  className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg"
/>
```

Change colors by modifying component:
```typescript
// In PointBalance.tsx
const getPercentageColor = (percentage?: number) => {
  if (!percentage) return 'text-gray-600';
  if (percentage > 0) return 'text-emerald-600'; // custom color
  return 'text-rose-600';
};
```

## Troubleshooting

### Balance Not Updating

**Problem**: Balance shows stale data

**Solutions**:
1. Verify backend endpoint `/api/points/balance` is implemented
2. Check that authentication token is being sent
3. Verify response format matches expected interface
4. Increase polling interval if API is slow
5. Check browser network tab for API errors

### API Errors

**Problem**: "Failed to fetch balance" error

**Solutions**:
1. Verify CORS configuration in backend
2. Check JWT token is valid and not expired
3. Verify backend service is running
4. Check firewall/network connectivity
5. Enable debug logging in usePointBalance hook

### Display Issues

**Problem**: Balance showing "0" or incorrect formatting

**Solutions**:
1. Check `decimals` prop matches API response
2. Verify `currency` symbol is correct
3. Check balance value is a valid number
4. Inspect browser console for TypeScript errors

### Performance Issues

**Problem**: Excessive API calls or slow updates

**Solutions**:
1. Increase `pollInterval` (e.g., 60000 for 1 minute)
2. Set `autoFetch: false` and fetch manually
3. Use React DevTools to check re-renders
4. Optimize backend API response time

## Required API Responses

Your backend must return balance data in this exact format:

```typescript
{
  "success": true,
  "balance": {
    "id": "string",              // Unique balance ID
    "userId": "string",          // User ID
    "totalBalance": 5250.75,     // Total balance (required)
    "availableBalance": 5000,    // Available to use (required)
    "lockedBalance": 200,        // Locked in transactions (optional)
    "pendingBalance": 50.75,     // Pending transactions (optional)
    "currency": "PTS",           // Currency code (optional)
    "decimals": 2,               // Decimal places (optional)
    "lastUpdated": "ISO string", // Update timestamp (required)
    "percentageChange": 5.2      // Change % (optional)
  },
  "timestamp": "ISO string"
}
```

## Next Steps

1. **Create Backend Endpoints** - Implement the balance API
2. **Test Integration** - Verify balance displays and updates
3. **Customize Styling** - Match your app's design system
4. **Add to Layout** - Place in header/sidebar/dashboard
5. **Monitor Performance** - Check API call frequency
6. **Deploy** - Push to production

## Related Documentation

- [Component README](POINT_BALANCE_README.md) - Complete API docs
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Architecture overview
- [Setup Checklist](SETUP_CHECKLIST.md) - Quick reference checklist
- [Example Component](PointBalanceExample.tsx) - Usage examples
- [Storybook Stories](PointBalance.stories.tsx) - Visual examples

---

**Last Updated**: March 26, 2026  
**Status**: Integration Ready
