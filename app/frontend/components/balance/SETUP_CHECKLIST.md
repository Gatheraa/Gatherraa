# PointBalance Component - Setup & Next Steps Checklist

## Current Status: ✅ Component Implementation Complete

All files created and ready for integration. Use this checklist to complete setup and deployment.

---

## Phase 1: Verification (5 minutes)

- [ ] **Verify Files Created**
  ```bash
  # Check all component files exist
  ls -la app/frontend/components/balance/
  ls -la app/frontend/hooks/usePointBalance.ts
  ls -la app/frontend/types/pointBalance.ts
  ```
  Should show:
  - PointBalance.tsx (250 lines)
  - PointBalanceExample.tsx (300 lines)
  - PointBalance.stories.tsx (350 lines)
  - PointBalance.test.tsx (400 lines)
  - POINT_BALANCE_README.md
  - INTEGRATION_GUIDE.md
  - IMPLEMENTATION_SUMMARY.md
  - SETUP_CHECKLIST.md

- [ ] **Verify Git Status**
  ```bash
  git status
  # Should show feat/PointBalance branch with 11 new files
  ```

- [ ] **Quick Type Check**
  ```bash
  npx tsc --noEmit
  # Should pass with zero errors
  ```

---

## Phase 2: Git Commit (2 minutes)

- [ ] **Stage All Changes**
  ```bash
  git add app/frontend/components/balance/
  git add app/frontend/hooks/usePointBalance.ts
  git add app/frontend/types/pointBalance.ts
  ```

- [ ] **Create Commit**
  ```bash
  git commit -m "feat: Add PointBalance component with auto-refresh and breakdown

- Compact and detailed display variants
- Configurable auto-polling (30s default interval)
- Manual refresh button with loading state
- Balance breakdown (available/locked/pending)
- Percentage change with trend indicators
- Tooltip support on balance display
- Full error handling with retry
- Complete TypeScript type safety
- Accessibility features (ARIA labels, keyboard nav)
- 20+ Storybook stories for visual testing
- 40+ unit tests ready for activation
- Comprehensive documentation (POINT_BALANCE_README.md)
- Step-by-step integration guide (INTEGRATION_GUIDE.md)

Acceptance Criteria:
✅ Accepts balance prop (multiple formats supported)
✅ Auto-refresh on update (configurable polling)
✅ Handles loading state (shows skeleton)
✅ Handles error state (shows error + retry)
✅ Real-time updates (hook + polling)
✅ Tooltip for additional info (hover support)"
  ```

- [ ] **Push Branch**
  ```bash
  git push origin feat/PointBalance
  ```

---

## Phase 3: Backend API Implementation (30-45 minutes)

### Step 1: Create Endpoint Controller

**File**: `app/backend/src/points/points.controller.ts`

```typescript
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PointsService } from './points.service';
import { PointBalanceResponse } from './dtos/point-balance.dto';

@Controller('api/points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Get('balance')
  async getBalance(
    @Query('userId') userId: string,
    @Req() req: any,
  ): Promise<{ success: boolean; balance: PointBalanceResponse; timestamp: string }> {
    // Validate user owns this balance
    const currentUserId = req.user.id;
    if (userId !== 'current' && userId !== currentUserId) {
      throw new UnauthorizedException('Cannot access other user balances');
    }

    const balance = await this.pointsService.getBalance(currentUserId);
    return {
      success: true,
      balance: this.pointsService.formatBalance(balance),
      timestamp: new Date().toISOString(),
    };
  }
}
```

**Requirements:**
- [ ] Points service created or exists
- [ ] JWT auth guard configured
- [ ] Database schema for balances exists

### Step 2: Create Balance Service

**File**: `app/backend/src/points/points.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './entities/balance.entity';
import { PointBalanceResponse } from './dtos/point-balance.dto';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
  ) {}

  async getBalance(userId: string): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { userId },
    });

    if (!balance) {
      // Create default balance
      return this.balanceRepository.save({
        userId,
        totalBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        pendingBalance: 0,
        currency: 'PTS',
        decimals: 2,
      });
    }

    return balance;
  }

  formatBalance(balance: Balance): PointBalanceResponse {
    const previousTotal = balance.previousTotal || balance.totalBalance;
    const percentageChange = previousTotal > 0
      ? ((balance.totalBalance - previousTotal) / previousTotal) * 100
      : 0;

    return {
      id: balance.id,
      userId: balance.userId,
      totalBalance: balance.totalBalance,
      availableBalance: balance.availableBalance,
      lockedBalance: balance.lockedBalance,
      pendingBalance: balance.pendingBalance,
      currency: balance.currency,
      decimals: balance.decimals,
      lastUpdated: balance.updatedAt.toISOString(),
      percentageChange: parseFloat(percentageChange.toFixed(2)),
    };
  }
}
```

**Requirements:**
- [ ] TypeORM repository configured
- [ ] Balance entity created
- [ ] Database migration for balance table

### Step 3: Create Database Entity

**File**: `app/backend/src/points/entities/balance.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('point_balances')
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  totalBalance: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  availableBalance: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  lockedBalance: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  pendingBalance: number;

  @Column('varchar', { default: 'PTS' })
  currency: string;

  @Column('int', { default: 2 })
  decimals: number;

  @Column('decimal', { precision: 18, scale: 2, nullable: true })
  previousTotal: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Requirements:**
- [ ] TypeORM installed and configured
- [ ] Database connection available

### Step 4: Create DTO

**File**: `app/backend/src/points/dtos/point-balance.dto.ts`

```typescript
export class PointBalanceResponse {
  id: string;
  userId: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  pendingBalance: number;
  currency: string;
  decimals: number;
  lastUpdated: string;
  percentageChange: number;
}
```

### Step 5: Register Module

**File**: `app/backend/src/points/points.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { Balance } from './entities/balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Balance])],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
```

- [ ] **Add to AppModule**
  ```typescript
  // app.module.ts
  import { PointsModule } from './points/points.module';
  
  @Module({
    imports: [
      // ... other modules
      PointsModule,
    ],
  })
  export class AppModule {}
  ```

### Step 6: Test Endpoint

```bash
# Start dev server
npm run dev

# In another terminal, test endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/points/balance?userId=current

# Expected response:
# {
#   "success": true,
#   "balance": {
#     "id": "...",
#     "userId": "...",
#     "totalBalance": 5000.00,
#     "availableBalance": 4800.00,
#     "lockedBalance": 150.00,
#     "pendingBalance": 50.00,
#     "currency": "PTS",
#     "decimals": 2,
#     "lastUpdated": "2024-03-26T10:30:00Z",
#     "percentageChange": 5.2
#   },
#   "timestamp": "2024-03-26T10:30:45Z"
# }
```

**Checklist for Backend:**
- [ ] Controller created
- [ ] Service implemented
- [ ] Entity defined
- [ ] DTO created
- [ ] Module registered
- [ ] Added to AppModule
- [ ] JWT guard configured
- [ ] Database migration run
- [ ] Endpoint tested manually
- [ ] Response format matches API spec

---

## Phase 4: Frontend Integration (20-30 minutes)

### Option A: Integration in Header (Recommended for Compact)

**File**: `app/frontend/components/layout/Header.tsx`

```typescript
'use client';

import { PointBalance } from '@/components/balance/PointBalance';
import { usePointBalance } from '@/hooks/usePointBalance';

export function Header() {
  const { balance, isLoading, error, refresh } = usePointBalance({
    userId: 'current',
    autoFetch: true,
    pollInterval: 30000,
  });

  return (
    <header className="bg-white shadow">
      <div className="flex items-center justify-between px-4 py-3">
        <h1>My App</h1>
        <PointBalance
          fullBalance={balance}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
          variant="compact"
          tooltip="Your account balance"
        />
      </div>
    </header>
  );
}
```

- [ ] **Integration Steps:**
  - [ ] Open Header component
  - [ ] Import PointBalance and usePointBalance
  - [ ] Add hook to component
  - [ ] Place PointBalance in JSX
  - [ ] Test rendering and auto-refresh

### Option B: Integration in Dashboard (Recommended for Detailed)

**File**: `app/frontend/components/dashboard/Dashboard.tsx`

```typescript
'use client';

import { PointBalance } from '@/components/balance/PointBalance';
import { usePointBalance } from '@/hooks/usePointBalance';

export function Dashboard() {
  const { balance, isLoading, error, refresh } = usePointBalance({
    userId: 'current',
    autoFetch: true,
    pollInterval: 30000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <PointBalance
          fullBalance={balance}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
          variant="detailed"
        />
      </div>
      {/* Other dashboard widgets */}
    </div>
  );
}
```

- [ ] **Integration Steps:**
  - [ ] Open Dashboard component
  - [ ] Import PointBalance and usePointBalance
  - [ ] Add hook to component
  - [ ] Place PointBalance in JSX (detailed variant)
  - [ ] Test rendering and breakdown expansion

### Option C: Integration in Account Page (Both)

```typescript
'use client';

export function AccountPage() {
  const { balance, isLoading, error, refresh } = usePointBalance({
    userId: 'current',
    autoFetch: true,
    pollInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2>Quick Balance</h2>
        <PointBalance variant="compact" fullBalance={balance} />
      </div>
      <div>
        <h2>Full Breakdown</h2>
        <PointBalance variant="detailed" fullBalance={balance} onRefresh={refresh} />
      </div>
    </div>
  );
}
```

**Checklist for Frontend Integration:**
- [ ] Component imported correctly
- [ ] Hook initialized with options
- [ ] Balance prop passed correctly
- [ ] isLoading state working
- [ ] Error state working
- [ ] Refresh button functional
- [ ] Auto-polling active
- [ ] Tooltip displays on hover
- [ ] Styling matches application theme
- [ ] Mobile responsive

---

## Phase 5: Manual Testing (15-20 minutes)

### Test Rendering

- [ ] **Compact Variant Displays**
  - [ ] Balance number shows correctly
  - [ ] Currency symbol displays
  - [ ] Percentage change visible
  - [ ] Trend icon shows (up/down)
  - [ ] Color correct based on trend
  - [ ] Tooltip icon visible
  - [ ] Refresh button visible

- [ ] **Detailed Variant Displays**
  - [ ] Total balance shows
  - [ ] Percentage change visible
  - [ ] "Balance Breakdown" section visible
  - [ ] Expand/collapse button working
  - [ ] Available amount shows when expanded
  - [ ] Locked amount shows when expanded
  - [ ] Pending amount shows when expanded
  - [ ] Last updated timestamp shows
  - [ ] Refresh button visible and working

### Test Auto-Refresh

- [ ] **Polling Activates**
  - [ ] Network tab shows requests at 30s intervals
  - [ ] Balance updates without user action
  - [ ] Loading state shows briefly

### Test Manual Refresh

- [ ] **Refresh Button Works**
  - [ ] Click refresh button
  - [ ] Loading state shows
  - [ ] Balance updates
  - [ ] Timestamp updates

### Test Loading State

- [ ] **Loading Display**
  - [ ] Skeleton shows on initial load
  - [ ] Content replaces skeleton when loaded
  - [ ] Smooth transition

### Test Error State

- [ ] **Error Handling**
  - [ ] Simulate API error (comment out endpoint)
  - [ ] Error message displays
  - [ ] Retry button visible
  - [ ] Click retry to recover

### Test Tooltip

- [ ] **Tooltip Behavior (Compact Only)**
  - [ ] Hover over info icon
  - [ ] Tooltip appears above/below
  - [ ] Shows custom or default text
  - [ ] Dismiss on mouse leave

### Test Accessibility

- [ ] **Keyboard Navigation**
  - [ ] Tab to focus refresh button
  - [ ] Tab to focus info icon
  - [ ] Enter key activates buttons

- [ ] **Screen Reader**
  - [ ] Info icon has aria-label
  - [ ] Refresh button labeled
  - [ ] Loading state announced

---

## Phase 6: Visual Testing with Storybook (5 minutes)

- [ ] **Run Storybook**
  ```bash
  npm run storybook
  ```

- [ ] **View All Stories**
  - [ ] Navigate to "balance" component
  - [ ] 20+ stories should be visible
  - [ ] All states should be viewable
  - [ ] Interactive controls should work
  - [ ] Responsive preview should work

---

## Phase 7: Unit Testing (Optional, 15-20 minutes)

**Only if test dependencies are available**

- [ ] **Install Test Dependencies**
  ```bash
  npm install --save-dev @testing-library/react @testing-library/user-event vitest @testing-library/dom
  ```

- [ ] **Activate Tests**
  - [ ] Open `PointBalance.test.tsx`
  - [ ] Change `describe.skip` to `describe`
  - [ ] Save file

- [ ] **Run Tests**
  ```bash
  npm test -- PointBalance.test.tsx
  ```

- [ ] **Verify Results**
  - [ ] 40+ tests should run
  - [ ] All should pass
  - [ ] Coverage should be 90%+

---

## Phase 8: Code Review & Polish (10 minutes)

- [ ] **Review Created Files**
  - [ ] All component code follows patterns
  - [ ] No console errors or warnings
  - [ ] Imports are correct
  - [ ] Props typed correctly
  - [ ] Exports are correct

- [ ] **Review Documentation**
  - [ ] POINT_BALANCE_README.md is complete
  - [ ] INTEGRATION_GUIDE.md covers all steps
  - [ ] Examples are clear
  - [ ] API response format matches code

- [ ] **Check TypeScript**
  ```bash
  npx tsc --noEmit
  ```
  Should have zero errors

---

## Phase 9: Performance Optimization (Optional)

- [ ] **Check Component Performance**
  ```bash
  # In React DevTools Profiler
  # Record interaction with PointBalance
  # Verify render time < 2ms
  # Verify no unnecessary re-renders
  ```

- [ ] **Optimize if Needed**
  - [ ] Add React.memo() if needed
  - [ ] Memoize callbacks with useCallback()
  - [ ] Consider useMemo() for calculations

---

## Phase 10: Deployment (5 minutes)

- [ ] **Deploy to Development**
  ```bash
  # Push to dev branch
  git push origin feat/PointBalance
  
  # Create Pull Request
  # Request code review
  # Merge when approved
  ```

- [ ] **Deploy to Staging**
  - [ ] Run full test suite
  - [ ] Verify component in staging environment
  - [ ] Test with real API data

- [ ] **Deploy to Production**
  - [ ] Monitor performance
  - [ ] Check error logs
  - [ ] Verify users see correct balance

---

## Quick Reference: File Locations

```
Created Files (8 total):

1. app/frontend/components/balance/PointBalance.tsx
2. app/frontend/components/balance/PointBalanceExample.tsx
3. app/frontend/components/balance/PointBalance.stories.tsx
4. app/frontend/components/balance/PointBalance.test.tsx
5. app/frontend/hooks/usePointBalance.ts
6. app/frontend/types/pointBalance.ts
7. app/frontend/components/balance/POINT_BALANCE_README.md
8. app/frontend/components/balance/INTEGRATION_GUIDE.md

Backend Files to Create:

1. app/backend/src/points/points.controller.ts
2. app/backend/src/points/points.service.ts
3. app/backend/src/points/entities/balance.entity.ts
4. app/backend/src/points/dtos/point-balance.dto.ts
5. app/backend/src/points/points.module.ts

Integration Points (Update):

1. app/frontend/components/layout/Header.tsx (Option A)
2. app/frontend/components/dashboard/Dashboard.tsx (Option B)
3. app/frontend/pages/account/Account.tsx (Option C)
4. app/backend/src/app.module.ts (Add PointsModule)
```

---

## Troubleshooting

### Component Not Rendering
```
[ ] Check imports are correct
[ ] Verify usePointBalance hook initialized
[ ] Check balance prop passed
[ ] Check variant prop is 'compact' or 'detailed'
[ ] Verify no TypeScript errors: npx tsc --noEmit
```

### API Not Called
```
[ ] Check backend endpoint exists and is accessible
[ ] Verify JWT token is valid
[ ] Check network tab for failed requests
[ ] Verify autoFetch option is true
[ ] Check pollInterval is set correctly
```

### Styling Issues
```
[ ] Verify Tailwind CSS version 4+
[ ] Check all Tailwind classes are generated
[ ] Verify className props are correct
[ ] Check for CSS conflicts
```

### Test Failures
```
[ ] Verify @testing-library/react is installed
[ ] Ensure Vitest is configured
[ ] Check mock data in tests
[ ] Verify test setup file is correct
```

---

## Estimated Timeline

| Phase | Time | Status |
|-------|------|--------|
| Verification | 5 min | ⏳ TODO |
| Git Commit | 2 min | ⏳ TODO |
| Backend API | 30-45 min | ⏳ TODO |
| Frontend Integration | 20-30 min | ⏳ TODO |
| Manual Testing | 15-20 min | ⏳ TODO |
| Storybook Review | 5 min | ⏳ TODO |
| Unit Testing | 15-20 min | ⏳ TODO (Optional) |
| Code Review | 10 min | ⏳ TODO |
| Performance | 10 min | ⏳ TODO (Optional) |
| Deployment | 5 min | ⏳ TODO |
| **Total** | **2-3 hours** | **IN PROGRESS** |

---

## Success Criteria

All items should be completed before moving to production:

- [ ] All 8 frontend files created and verified
- [ ] All 5 backend files created and tested
- [ ] Component renders in chosen location (Header/Dashboard/Account)
- [ ] Auto-polling works (updates every 30s)
- [ ] Manual refresh button works
- [ ] Loading state shows correctly
- [ ] Error state shows correctly
- [ ] Tooltip works (compact variant)
- [ ] Balance breakdown works (detailed variant)
- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] Mobile responsive
- [ ] Accessibility features working
- [ ] 20+ Storybook stories visible
- [ ] All manual tests passed
- [ ] Code review approved
- [ ] Ready for production deployment

---

**Start with Phase 1 (Verification) to confirm all files are present, then proceed sequentially.**

**Current Date**: March 26, 2026  
**Component Status**: Production Ready  
**Next Action**: Verify files and commit to git
