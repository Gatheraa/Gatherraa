# Feature Flag System - Usage Examples

This document provides practical examples of using the feature flag system in various scenarios.

## Table of Contents

1. [Simple Boolean Flags](#simple-boolean-flags)
2. [Gradual Rollouts](#gradual-rollouts)
3. [User Segmentation](#user-segmentation)
4. [A/B Testing](#ab-testing)
5. [Emergency Kill Switches](#emergency-kill-switches)
6. [Frontend Integration](#frontend-integration)
7. [Backend Route Protection](#backend-route-protection)

## Simple Boolean Flags

### Create a Simple Flag

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "dark_mode",
    "name": "Dark Mode",
    "description": "Enable dark mode UI",
    "type": "boolean",
    "environment": "production",
    "defaultValue": false
  }'
```

### Evaluate the Flag

```bash
curl -X POST http://localhost:3000/feature-flags/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "flagKey": "dark_mode",
    "userId": "user-123",
    "context": {}
  }'
```

### Frontend Usage

```tsx
function App() {
  const { isEnabled } = useFeatureFlag('dark_mode');

  return (
    <div className={isEnabled ? 'dark' : 'light'}>
      <h1>My App</h1>
    </div>
  );
}
```

## Gradual Rollouts

### 10% Rollout

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new_search_algorithm",
    "name": "New Search Algorithm",
    "description": "Improved search with ML ranking",
    "type": "rollout",
    "environment": "production",
    "defaultValue": false,
    "rolloutConfig": {
      "percentage": 10,
      "seed": "search_v2"
    }
  }'
```

### Increase to 25%

```bash
curl -X PUT http://localhost:3000/feature-flags/new_search_algorithm \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutConfig": {
      "percentage": 25,
      "seed": "search_v2"
    }
  }'
```

### Increase to 50%, then 100%

```bash
# 50%
curl -X PUT http://localhost:3000/feature-flags/new_search_algorithm \
  -H "Content-Type: application/json" \
  -d '{"rolloutConfig": {"percentage": 50}}'

# 100%
curl -X PUT http://localhost:3000/feature-flags/new_search_algorithm \
  -H "Content-Type: application/json" \
  -d '{"rolloutConfig": {"percentage": 100}}'
```

## User Segmentation

### Admin-Only Feature

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "admin_dashboard",
    "name": "Admin Dashboard",
    "type": "boolean",
    "defaultValue": false,
    "targetingRules": [
      {
        "name": "Admin Users",
        "segments": [[
          {
            "field": "role",
            "operator": "equals",
            "value": "admin"
          }
        ]],
        "value": true
      }
    ]
  }'
```

### Premium Users OR Beta Testers

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "advanced_analytics",
    "name": "Advanced Analytics",
    "type": "boolean",
    "defaultValue": false,
    "targetingRules": [
      {
        "name": "Premium or Beta",
        "segments": [
          [{"field": "role", "operator": "equals", "value": "premium"}],
          [{"field": "email", "operator": "contains", "value": "@beta.com"}]
        ],
        "value": true
      }
    ]
  }'
```

### Multiple Conditions (AND)

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "enterprise_features",
    "name": "Enterprise Features",
    "type": "boolean",
    "defaultValue": false,
    "targetingRules": [
      {
        "name": "Enterprise in US",
        "segments": [[
          {"field": "role", "operator": "equals", "value": "enterprise"},
          {"field": "country", "operator": "equals", "value": "US"}
        ]],
        "value": true
      }
    ]
  }'
```

## A/B Testing

### Simple A/B Test (50/50)

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "checkout_button_color",
    "name": "Checkout Button Color Test",
    "type": "ab_test",
    "defaultValue": "blue",
    "abTestConfig": {
      "variants": [
        {"name": "control", "weight": 50, "value": "blue"},
        {"name": "treatment", "weight": 50, "value": "green"}
      ]
    }
  }'
```

### Multi-Variant Test

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "pricing_page_layout",
    "name": "Pricing Page Layout Test",
    "type": "ab_test",
    "defaultValue": "original",
    "abTestConfig": {
      "exposurePercentage": 80,
      "variants": [
        {"name": "control", "weight": 40, "value": "original"},
        {"name": "variant_a", "weight": 30, "value": "simplified"},
        {"name": "variant_b", "weight": 20, "value": "detailed"},
        {"name": "variant_c", "weight": 10, "value": "minimal"}
      ]
    }
  }'
```

### Frontend A/B Test Usage

```tsx
function PricingPage() {
  const { variant } = useABTestVariant('pricing_page_layout');

  switch (variant) {
    case 'variant_a':
      return <SimplifiedPricing />;
    case 'variant_b':
      return <DetailedPricing />;
    case 'variant_c':
      return <MinimalPricing />;
    default:
      return <OriginalPricing />;
  }
}
```

## Emergency Kill Switches

### Activate Kill Switch

```bash
curl -X POST http://localhost:3000/feature-flags/problematic_feature/kill-switch \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Critical performance issue - 500 errors on checkout"
  }'
```

### Check Flag After Kill Switch

```bash
curl -X GET http://localhost:3000/feature-flags/problematic_feature
```

Response:
```json
{
  "key": "problematic_feature",
  "status": "inactive",
  "defaultValue": false,
  "metadata": {
    "killSwitchActivated": true,
    "killSwitchReason": "Critical performance issue - 500 errors on checkout",
    "killSwitchTimestamp": "2026-02-25T10:30:00.000Z"
  }
}
```

## Frontend Integration

### Basic Setup

```tsx
// app/layout.tsx
import { FeatureFlagProvider } from '@/lib/feature-flags';

export default function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html>
      <body>
        <FeatureFlagProvider
          userId={user?.id}
          context={{
            role: user?.role,
            email: user?.email,
            country: user?.country,
          }}
          enablePolling={true}
          pollingInterval={30000}
        >
          {children}
        </FeatureFlagProvider>
      </body>
    </html>
  );
}
```

### Using Hooks

```tsx
function Dashboard() {
  const { isEnabled: newDashboard } = useFeatureFlag('new_dashboard');
  const { value: maxItems } = useFeatureFlagValue<number>('dashboard_items', 5);
  const { variant } = useABTestVariant('dashboard_layout');

  return (
    <div>
      {newDashboard ? <NewDashboard /> : <OldDashboard />}
      <ItemList maxItems={maxItems} />
      {variant === 'compact' && <CompactView />}
    </div>
  );
}
```

### Using Components

```tsx
function FeatureShowcase() {
  return (
    <>
      <FeatureGate flagKey="beta_features" fallback={<ComingSoon />}>
        <BetaFeatures />
      </FeatureGate>

      <ABTest
        flagKey="hero_section"
        variants={{
          control: <OriginalHero />,
          variant_a: <VideoHero />,
          variant_b: <AnimatedHero />,
        }}
      />
    </>
  );
}
```

### Bulk Evaluation

```tsx
function Analytics() {
  const { flags, isLoading } = useBulkFeatureFlags([
    'advanced_charts',
    'export_csv',
    'real_time_data',
    'custom_dashboards',
  ]);

  if (isLoading) return <Spinner />;

  return (
    <div>
      {flags.advanced_charts?.value && <AdvancedCharts />}
      {flags.export_csv?.value && <ExportButton />}
      {flags.real_time_data?.value && <RealtimeData />}
      {flags.custom_dashboards?.value && <DashboardBuilder />}
    </div>
  );
}
```

## Backend Route Protection

### Simple Protection

```typescript
import { FeatureFlag } from './feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from './feature-flags/guards/feature-flag.guard';

@Controller('beta')
@UseGuards(FeatureFlagGuard)
export class BetaController {
  @Get('features')
  @FeatureFlag('beta_api')
  getBetaFeatures() {
    return { features: ['ai_search', 'smart_suggestions'] };
  }
}
```

### Programmatic Check

```typescript
@Injectable()
export class EventService {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  async createEvent(userId: string, eventData: any) {
    const enrichedData = { ...eventData };

    // Check if AI enrichment is enabled
    const aiEnrichment = await this.featureFlagsService.evaluateFlag({
      flagKey: 'ai_event_enrichment',
      userId,
      context: { eventType: eventData.type },
    });

    if (aiEnrichment.value) {
      enrichedData.aiSuggestions = await this.getAISuggestions(eventData);
    }

    return this.eventRepository.save(enrichedData);
  }
}
```

## Whitelist Management

### Add User to Whitelist

```bash
curl -X POST http://localhost:3000/feature-flags/new_feature/whitelist/user-123
```

### Remove from Whitelist

```bash
curl -X DELETE http://localhost:3000/feature-flags/new_feature/whitelist/user-123
```

### Create Flag with Whitelist

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "internal_tools",
    "name": "Internal Tools",
    "type": "boolean",
    "defaultValue": false,
    "whitelist": ["admin-1", "admin-2", "developer-1"]
  }'
```

## Analytics

### Get Flag Analytics

```bash
curl -X GET "http://localhost:3000/feature-flags/new_dashboard/analytics?startDate=2026-01-01&endDate=2026-02-01"
```

Response:
```json
{
  "flagKey": "new_dashboard",
  "totalEvaluations": 45230,
  "uniqueUsers": 12890,
  "valueDistribution": {
    "true": 4523,
    "false": 40707
  },
  "reasonDistribution": {
    "rollout": 4523,
    "default": 40707
  },
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-02-01T00:00:00.000Z"
}
```

## Complete Example: Feature Launch

### Step 1: Create Flag (Disabled)

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "collaborative_editing",
    "name": "Collaborative Editing",
    "description": "Real-time collaborative document editing",
    "type": "rollout",
    "environment": "production",
    "defaultValue": false,
    "rolloutConfig": {
      "percentage": 0
    },
    "whitelist": ["internal-tester-1", "internal-tester-2"]
  }'
```

### Step 2: Internal Testing (Whitelist Only)

Frontend code is already in place:
```tsx
<FeatureGate flagKey="collaborative_editing">
  <CollaborativeEditor />
</FeatureGate>
```

### Step 3: 5% Rollout

```bash
curl -X PUT http://localhost:3000/feature-flags/collaborative_editing \
  -H "Content-Type: application/json" \
  -d '{"rolloutConfig": {"percentage": 5}}'
```

### Step 4: Monitor Analytics

```bash
curl -X GET http://localhost:3000/feature-flags/collaborative_editing/analytics
```

### Step 5: Increase to 25%

```bash
curl -X PUT http://localhost:3000/feature-flags/collaborative_editing \
  -H "Content-Type: application/json" \
  -d '{"rolloutConfig": {"percentage": 25}}'
```

### Step 6: Full Rollout

```bash
curl -X PUT http://localhost:3000/feature-flags/collaborative_editing \
  -H "Content-Type: application/json" \
  -d '{"rolloutConfig": {"percentage": 100}}'
```

### Step 7: If Issues - Kill Switch

```bash
curl -X POST http://localhost:3000/feature-flags/collaborative_editing/kill-switch \
  -H "Content-Type: application/json" \
  -d '{"reason": "Memory leak detected in collaborative session management"}'
```

## Environment-Specific Flags

### Development Only

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "debug_panel",
    "name": "Debug Panel",
    "type": "boolean",
    "environment": "development",
    "defaultValue": true
  }'
```

### Production Only

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "analytics_tracking",
    "name": "Analytics Tracking",
    "type": "boolean",
    "environment": "production",
    "defaultValue": true
  }'
```
