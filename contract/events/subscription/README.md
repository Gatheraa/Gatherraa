# Subscription Contract for Stellar Events Platform

A comprehensive Soroban smart contract implementing a subscription model for recurring event access on the Stellar blockchain.

## Features

### Core Subscription Management
- **Multiple Subscription Tiers**: Support for Monthly and Annual subscription plans
- **Automatic Renewal**: Configurable auto-renewal with token approvals
- **Flexible Cancellation**: Cancel anytime with prorated refunds
- **Pause/Resume**: Users can pause subscriptions and resume later with remaining time preserved

### Advanced Features
- **Subscription Upgrades/Downgrades**: Seamlessly change plans with prorated calculations
- **Family Plans**: Add multiple family members to a single subscription
- **Gift Subscriptions**: Purchase and gift subscriptions to other users
- **Grace Period**: Configurable grace period for failed payments
- **Category-Based Access**: Control access to specific event categories per plan

### Payment & Refunds
- **Soroban Token Integration**: Uses native Soroban token standard for payments
- **Prorated Refunds**: Accurate refund calculations based on remaining subscription time
- **Prorated Upgrades**: Fair pricing when changing between plans

## Architecture

### Storage Structure

The contract uses efficient storage patterns:
- **Instance Storage**: Global configuration (admin, token address, grace period)
- **Persistent Storage**: User subscriptions, plans, and gifted subscriptions

### Key Data Types

#### SubscriptionTier
```rust
pub enum SubscriptionTier {
    Monthly,
    Annual,
}
```

#### SubscriptionStatus
```rust
pub enum SubscriptionStatus {
    Active,
    Paused,
    Cancelled,
    Expired,
    GracePeriod,
}
```

#### SubscriptionPlan
```rust
pub struct SubscriptionPlan {
    pub plan_id: u32,
    pub tier: SubscriptionTier,
    pub price: i128,
    pub duration_days: u32,
    pub category_ids: Vec<u32>,
    pub max_family_members: u32,
    pub is_active: bool,
}
```

#### UserSubscription
```rust
pub struct UserSubscription {
    pub subscription_id: u64,
    pub user: Address,
    pub plan_id: u32,
    pub status: SubscriptionStatus,
    pub start_date: u64,
    pub end_date: u64,
    pub last_payment_date: u64,
    pub auto_renew: bool,
    pub is_family_plan: bool,
    pub family_members: Vec<Address>,
}
```

## Contract Functions

### Initialization

#### `initialize(admin, token_address, grace_period_days)`
Initialize the contract with admin address, payment token, and grace period configuration.

### Plan Management

#### `create_plan(tier, price, duration_days, category_ids, max_family_members) -> plan_id`
Create a new subscription plan (admin only).

#### `update_plan(plan_id, price, category_ids, is_active)`
Update an existing plan's pricing and configuration (admin only).

#### `get_plan(plan_id) -> Option<SubscriptionPlan>`
Retrieve plan details.

### Subscription Lifecycle

#### `subscribe(user, plan_id) -> subscription_id`
Subscribe to a plan. Requires token approval for payment.

#### `renew_subscription(user)`
Manually renew a subscription or handle automatic renewal.

#### `cancel_subscription(user)`
Cancel subscription with prorated refund calculation.

#### `pause_subscription(user)`
Pause an active subscription, preserving remaining time.

#### `resume_subscription(user)`
Resume a paused subscription with remaining time applied.

### Plan Changes

#### `change_plan(user, new_plan_id)`
Upgrade or downgrade subscription with prorated pricing.

### Family Plans

#### `add_family_member(owner, member)`
Add a family member to the subscription.

#### `remove_family_member(owner, member)`
Remove a family member from the subscription.

### Gift Subscriptions

#### `gift_subscription(from, to, plan_id) -> gift_id`
Purchase a subscription as a gift for another user.

#### `claim_gift(user, gift_id) -> subscription_id`
Claim a gifted subscription.

### Subscription Management

#### `set_auto_renew(user, auto_renew)`
Toggle automatic renewal on/off.

#### `check_subscription_status(user) -> SubscriptionStatus`
Check current subscription status and handle grace period logic.

#### `get_subscription(user) -> Option<UserSubscription>`
Retrieve user's subscription details.

### Access Control

#### `has_category_access(user, category_id) -> bool`
Check if user has access to a specific event category.

## Events

The contract emits events for all major actions:

- `subscription_created`: New subscription created
- `subscription_renewed`: Subscription renewed
- `subscription_cancelled`: Subscription cancelled with refund
- `subscription_paused`: Subscription paused
- `subscription_resumed`: Subscription resumed
- `subscription_upgraded`: Plan changed
- `family_member_added`: Family member added
- `gift_created`: Gift subscription created

## Usage Examples

### Creating a Monthly Plan

```rust
let category_ids = vec![&env, 1, 2, 3];
let plan_id = contract.create_plan(
    &SubscriptionTier::Monthly,
    &1000, // 10.00 tokens (assuming 2 decimals)
    &30,   // 30 days
    &category_ids,
    &5,    // Max 5 family members
);
```

### Subscribing to a Plan

```rust
// User must first approve token spending
token.approve(&user, &contract_address, &1000, &expiration);

// Subscribe
let subscription_id = contract.subscribe(&user, &plan_id);
```

### Upgrading Subscription

```rust
// Upgrade from monthly to annual plan
contract.change_plan(&user, &annual_plan_id);
// Prorated amount is automatically calculated and charged/refunded
```

### Adding Family Members

```rust
contract.add_family_member(&owner, &family_member_1);
contract.add_family_member(&owner, &family_member_2);
```

### Gifting a Subscription

```rust
// Purchase gift
let gift_id = contract.gift_subscription(&gifter, &recipient, &plan_id);

// Recipient claims
let subscription_id = contract.claim_gift(&recipient, &gift_id);
```

## Prorated Calculations

### Refund Calculation
```
refund = (remaining_time / total_time) * price
```

### Plan Change Calculation
```
old_plan_remaining_value = (old_price * remaining_time) / total_time
new_plan_prorated_value = (new_price * remaining_time) / new_plan_duration
amount_due = new_plan_prorated_value - old_plan_remaining_value
```

## Grace Period

When a subscription expires and auto-renewal fails:
1. Subscription enters `GracePeriod` status
2. User retains access during grace period
3. After grace period expires, status changes to `Expired`
4. User loses access to subscribed categories

## Security Considerations

1. **Authentication**: All user actions require `require_auth()`
2. **Admin Controls**: Plan management restricted to admin
3. **Token Safety**: Uses official Soroban token interface
4. **Overflow Protection**: Safe arithmetic operations
5. **State Validation**: Comprehensive status checks before operations

## Testing

Comprehensive test suite included covering:
- Subscription lifecycle (create, renew, cancel)
- Pause and resume functionality
- Plan upgrades and downgrades
- Family plan management
- Gift subscriptions
- Prorated refund calculations
- Grace period handling
- Access control validation

Run tests:
```bash
cargo test
```

## Building

Build the contract:
```bash
cargo build --target wasm32-unknown-unknown --release
```

Optimize the WASM:
```bash
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/subscription_contract.wasm
```

## Deployment

1. Build and optimize the contract
2. Deploy to Stellar network:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription_contract.wasm \
  --source <SOURCE_ACCOUNT> \
  --network <NETWORK>
```

3. Initialize the contract:
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_ACCOUNT> \
  --network <NETWORK> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --token_address <TOKEN_ADDRESS> \
  --grace_period_days 7
```

## Integration with Event System

This subscription contract integrates with the existing event ticketing system:

1. **Category Access**: Event categories can be restricted to subscribers
2. **Ticket Discounts**: Subscribers can receive special pricing
3. **Priority Access**: Subscribers get early access to events
4. **Family Benefits**: Family members share subscription benefits

## Future Enhancements

Potential improvements:
- Multi-token support for different payment options
- Subscription bundles and promotions
- Loyalty rewards for long-term subscribers
- Trial periods for new users
- Corporate/enterprise plans
- Referral program integration

## License

MIT License

## Support

For issues and questions, please open an issue in the repository.
