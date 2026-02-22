# Coupon and Discount System

A comprehensive, flexible coupon and discount system for the Gatherraa platform with support for various discount types, usage limits, expiration, and stackability rules.

## Features

### Core Functionality
- **Multiple Discount Types**: Percentage and fixed amount discounts
- **Usage Limits**: Per coupon and per user limits with atomic tracking
- **Expiration Management**: Start and end dates for coupons
- **Stackability Rules**: Control how coupons can be combined
- **Scope Restrictions**: Global, user-specific, event-specific, category-specific, and affiliate coupons
- **Bulk Generation**: Generate multiple coupons at once
- **Validation Logic**: Comprehensive coupon validation with detailed error messages
- **Atomic Operations**: Thread-safe usage tracking using database transactions

### Advanced Features
- **Affiliate Support**: Commission-based affiliate coupon system
- **Caching**: Redis-based caching for performance
- **Audit Trail**: Complete tracking of coupon creation, usage, and modifications
- **Flexible Metadata**: Support for custom rules and restrictions
- **Statistics**: Usage analytics and reporting

## API Endpoints

### Coupon Management
```
POST   /coupons                    # Create coupon
PUT    /coupons/:id               # Update coupon
GET    /coupons/:id               # Get coupon details
GET    /coupons                   # Query coupons with filters
DELETE /coupons/:id               # Delete coupon
GET    /coupons/:id/stats         # Get coupon usage statistics
```

### Coupon Operations
```
POST   /coupons/validate           # Validate coupon for use
POST   /coupons/apply              # Apply coupon to order
POST   /coupons/bulk-generate     # Generate multiple coupons
GET    /coupons/user/history      # Get user's coupon usage history
```

## Data Models

### Coupon Entity
```typescript
{
  id: string;
  code: string;                    // Unique coupon code
  name: string;                    // Display name
  description?: string;            // Optional description
  type: 'percentage' | 'fixed';    // Discount type
  status: 'active' | 'inactive' | 'expired' | 'depleted';
  scope: 'global' | 'user_specific' | 'affiliate' | 'event_specific' | 'category_specific';
  discountValue: number;           // Percentage (0-100) or fixed amount
  currency?: string;               // Required for fixed discounts
  maxUses?: number;                // Total usage limit
  maxUsesPerUser?: number;         // Per-user limit
  currentUses: number;             // Current usage count
  expiresAt?: Date;                // Expiration date
  startsAt?: Date;                 // Valid from date
  stackabilityRule: 'none' | 'all' | 'category' | 'exclusive';
  category?: string;               // For category-based stacking
  userId?: string;                 // User-specific coupons
  eventId?: string;                // Event-specific coupons
  categoryId?: string;             // Category-specific coupons
  affiliateId?: string;            // Affiliate user ID
  affiliateCommission: number;     // Commission percentage
  minimumAmount: number;           // Minimum order amount
  maximumDiscount?: number;        // Maximum discount cap
  metadata?: {                     // Custom rules and data
    tags?: string[];
    applicableProducts?: string[];
    excludedProducts?: string[];
    applicableCategories?: string[];
    excludedCategories?: string[];
    customData?: Record<string, any>;
  };
  createdBy: string;               // Creator user ID
  createdAt: Date;
  updatedAt: Date;
}
```

### Coupon Usage Entity
```typescript
{
  id: string;
  couponId: string;
  userId: string;
  orderId?: string;
  discountAmount: number;
  currency?: string;
  appliedTo?: {                   // Detailed application info
    items?: Array<{
      id: string;
      type: string;
      originalAmount: number;
      discountAmount: number;
    }>;
    totalOriginalAmount: number;
    totalDiscountAmount: number;
  };
  usedAt: Date;
  createdAt: Date;
}
```

## Usage Examples

### Creating a Coupon
```typescript
POST /coupons
{
  "code": "WELCOME20",
  "name": "Welcome Discount",
  "description": "20% off for new users",
  "type": "percentage",
  "discountValue": 20,
  "maxUses": 1000,
  "maxUsesPerUser": 1,
  "expiresAt": "2024-12-31T23:59:59Z",
  "minimumAmount": 50,
  "stackabilityRule": "all"
}
```

### Validating a Coupon
```typescript
POST /coupons/validate
{
  "code": "WELCOME20",
  "userId": "user-123",
  "orderAmount": 100,
  "existingCoupons": []
}
```

Response:
```json
{
  "isValid": true,
  "coupon": {
    "id": "coupon-123",
    "code": "WELCOME20",
    "name": "Welcome Discount",
    "type": "percentage",
    "discountValue": 20,
    "minimumAmount": 50,
    "maximumDiscount": null
  },
  "discountAmount": 20,
  "finalAmount": 80
}
```

### Applying a Coupon
```typescript
POST /coupons/apply
{
  "code": "WELCOME20",
  "userId": "user-123",
  "orderAmount": 100,
  "orderId": "order-456"
}
```

Response:
```json
{
  "success": true,
  "coupon": {
    "id": "coupon-123",
    "code": "WELCOME20",
    "name": "Welcome Discount",
    "type": "percentage",
    "discountValue": 20
  },
  "discountAmount": 20,
  "finalAmount": 80,
  "usageId": "usage-789"
}
```

### Bulk Generating Coupons
```typescript
POST /coupons/bulk-generate
{
  "namePrefix": "BULK",
  "description": "Bulk generated coupons",
  "type": "fixed",
  "discountValue": 10,
  "currency": "USD",
  "count": 100,
  "maxUses": 1,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

## Stackability Rules

### None
- Coupon cannot be combined with any other coupons
- `stackabilityRule: "none"`

### All
- Coupon can be combined with any other coupons
- `stackabilityRule: "all"`

### Category
- Coupon can only be combined with coupons from the same category
- Requires `category` field to be set
- `stackabilityRule: "category"`

### Exclusive
- Exclusive coupon that cannot be combined with others
- Similar to "none" but with different semantics
- `stackabilityRule: "exclusive"`

## Scope Types

### Global
- Can be used by any user
- `scope: "global"`

### User Specific
- Can only be used by a specific user
- Requires `userId` field
- `scope: "user_specific"`

### Affiliate
- Affiliate coupon with commission tracking
- Requires `affiliateId` and `affiliateCommission`
- `scope: "affiliate"`

### Event Specific
- Can only be used for specific events
- Requires `eventId` field
- `scope: "event_specific"`

### Category Specific
- Can only be used for specific categories
- Requires `categoryId` field
- `scope: "category_specific"`

## Validation Logic

The system performs comprehensive validation including:

1. **Basic Validation**
   - Coupon exists and is active
   - Not expired or not yet valid
   - Usage limits not exceeded

2. **Scope Validation**
   - User-specific coupons check user ID
   - Event-specific coupons check event ID
   - Category-specific coupons check category ID

3. **Business Rules**
   - Minimum order amount requirements
   - Maximum discount caps
   - Stackability rules compliance

4. **Usage Tracking**
   - Atomic increment of usage counters
   - Per-user and global limits enforcement

## Performance Considerations

### Caching
- Coupons are cached for 5 minutes using Redis
- Cache invalidation on updates
- Reduces database load for frequently accessed coupons

### Database Optimization
- Indexed fields: code, status, expiresAt, createdBy, affiliateId
- Efficient queries with proper filtering
- Atomic operations for usage tracking

### Bulk Operations
- Bulk generation for creating multiple coupons
- Batch validation for multiple coupons
- Efficient cleanup of expired coupons

## Security Features

### Access Control
- Role-based access (Admin, Organizer)
- User-specific coupon restrictions
- Audit trail for all operations

### Data Validation
- Comprehensive input validation
- SQL injection prevention
- Type-safe operations

### Rate Limiting
- Redis-based rate limiting for validation endpoints
- Prevents abuse of coupon validation

## Integration Points

### Payment System
- Coupons integrate with existing payment entities
- Discount amounts calculated and applied during payment processing
- Usage tracking tied to payment transactions

### User Management
- User-specific coupons linked to user entities
- Affiliate commission tracking
- Usage history per user

### Event Management
- Event-specific coupons for ticket purchases
- Category-based restrictions for event types

## Monitoring and Analytics

### Usage Statistics
- Total uses, unique users, discount amounts
- Average discount per coupon
- Usage patterns and trends

### Performance Metrics
- Validation response times
- Cache hit rates
- Database query performance

### Business Metrics
- Revenue impact of coupons
- User acquisition through coupon campaigns
- Affiliate performance tracking

## Future Enhancements

1. **Advanced Stackability**: More complex stacking rules with priorities
2. **Dynamic Discounts**: Time-based or usage-based discount adjustments
3. **Coupon Templates**: Predefined coupon configurations
4. **Auto-apply**: Automatic application of best available coupons
5. **Coupon Campaigns**: Campaign-based coupon management
6. **Advanced Analytics**: Detailed reporting and insights
7. **Multi-currency**: Enhanced currency support
8. **Coupon Sharing**: Social features for coupon sharing

## Technical Implementation Notes

- **Atomic Operations**: Usage tracking uses database transactions
- **Caching Strategy**: Redis for high-performance coupon lookups
- **Database Design**: Optimized indexes and relationships
- **Error Handling**: Comprehensive error messages and logging
- **Type Safety**: Full TypeScript implementation with proper types
- **Scalability**: Designed for high-volume coupon usage
- **Maintainability**: Clean architecture with separation of concerns