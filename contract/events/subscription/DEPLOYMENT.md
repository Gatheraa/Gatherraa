# Deployment Guide - Subscription Contract

## Prerequisites

1. **Rust and Cargo** installed
2. **Soroban CLI** installed:
   ```bash
   cargo install --locked soroban-cli
   ```
3. **Stellar account** with funds for deployment
4. **Token contract** deployed (for payments)

## Build Process

### 1. Build the Contract

```bash
cd contract/subscription_contract
cargo build --target wasm32-unknown-unknown --release
```

### 2. Optimize the WASM

```bash
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/subscription_contract.wasm
```

This creates an optimized `subscription_contract.optimized.wasm` file.

## Network Configuration

### Testnet Setup

```bash
# Configure testnet network
soroban network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Create or import identity
soroban keys generate --global admin --network testnet

# Fund the account
soroban keys fund admin --network testnet
```

### Mainnet Setup

```bash
# Configure mainnet network
soroban network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"

# Import your mainnet key
soroban keys add --global admin --secret-key
```

## Deployment Steps

### 1. Deploy the Contract

```bash
# Deploy to testnet
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription_contract.optimized.wasm \
  --source admin \
  --network testnet)

echo "Contract deployed at: $CONTRACT_ID"
```

### 2. Initialize the Contract

```bash
# Get admin address
ADMIN_ADDRESS=$(soroban keys address admin)

# Set token address (replace with your token contract ID)
TOKEN_ADDRESS="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Initialize contract
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --token_address $TOKEN_ADDRESS \
  --grace_period_days 7
```

### 3. Create Subscription Plans

#### Monthly Plan

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- create_plan \
  --tier '{"Monthly":{}}' \
  --price 1000000000 \
  --duration_days 30 \
  --category_ids '[1,2,3]' \
  --max_family_members 5
```

#### Annual Plan

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- create_plan \
  --tier '{"Annual":{}}' \
  --price 10000000000 \
  --duration_days 365 \
  --category_ids '[1,2,3,4,5,6]' \
  --max_family_members 10
```

## User Operations

### Subscribe to a Plan

```bash
# User must first approve token spending
soroban contract invoke \
  --id $TOKEN_ADDRESS \
  --source user \
  --network testnet \
  -- approve \
  --from $USER_ADDRESS \
  --spender $CONTRACT_ID \
  --amount 1000000000 \
  --expiration_ledger 1000000

# Subscribe
soroban contract invoke \
  --id $CONTRACT_ID \
  --source user \
  --network testnet \
  -- subscribe \
  --user $USER_ADDRESS \
  --plan_id 1
```

### Check Subscription Status

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  -- get_subscription \
  --user $USER_ADDRESS
```

### Cancel Subscription

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source user \
  --network testnet \
  -- cancel_subscription \
  --user $USER_ADDRESS
```

### Pause Subscription

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source user \
  --network testnet \
  -- pause_subscription \
  --user $USER_ADDRESS
```

### Resume Subscription

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source user \
  --network testnet \
  -- resume_subscription \
  --user $USER_ADDRESS
```

### Upgrade/Downgrade Plan

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source user \
  --network testnet \
  -- change_plan \
  --user $USER_ADDRESS \
  --new_plan_id 2
```

### Add Family Member

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source owner \
  --network testnet \
  -- add_family_member \
  --owner $OWNER_ADDRESS \
  --member $MEMBER_ADDRESS
```

### Gift Subscription

```bash
# Purchase gift
GIFT_ID=$(soroban contract invoke \
  --id $CONTRACT_ID \
  --source gifter \
  --network testnet \
  -- gift_subscription \
  --from $GIFTER_ADDRESS \
  --to $RECIPIENT_ADDRESS \
  --plan_id 1)

# Recipient claims gift
soroban contract invoke \
  --id $CONTRACT_ID \
  --source recipient \
  --network testnet \
  -- claim_gift \
  --user $RECIPIENT_ADDRESS \
  --gift_id $GIFT_ID
```

## Monitoring and Maintenance

### Check Plan Details

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  -- get_plan \
  --plan_id 1
```

### Update Plan (Admin Only)

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network testnet \
  -- update_plan \
  --plan_id 1 \
  --price 1200000000 \
  --category_ids '[1,2,3,4]' \
  --is_active true
```

### Check Category Access

```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  -- has_category_access \
  --user $USER_ADDRESS \
  --category_id 1
```

## Event Monitoring

Monitor contract events using Stellar's event streaming:

```bash
soroban events \
  --start-ledger <START_LEDGER> \
  --id $CONTRACT_ID \
  --network testnet
```

Key events to monitor:
- `subscription_created`
- `subscription_renewed`
- `subscription_cancelled`
- `subscription_paused`
- `subscription_resumed`
- `subscription_upgraded`
- `family_member_added`
- `gift_created`

## Automated Renewal System

For production, implement an automated renewal system:

1. **Monitor Subscriptions**: Query subscriptions nearing expiration
2. **Check Auto-Renew**: Filter for `auto_renew = true`
3. **Process Renewals**: Call `renew_subscription` for eligible users
4. **Handle Failures**: Move to grace period if payment fails
5. **Notify Users**: Send notifications for renewals and failures

Example monitoring script:

```javascript
// Pseudo-code for renewal automation
async function processRenewals() {
  const expiringSubscriptions = await queryExpiringSubscriptions();
  
  for (const sub of expiringSubscriptions) {
    if (sub.auto_renew) {
      try {
        await contract.renew_subscription(sub.user);
        await notifyUser(sub.user, 'renewal_success');
      } catch (error) {
        await notifyUser(sub.user, 'renewal_failed');
        // Subscription enters grace period automatically
      }
    }
  }
}

// Run every hour
setInterval(processRenewals, 3600000);
```

## Cost Estimation

### Deployment Costs
- Contract deployment: ~0.5 XLM
- Contract initialization: ~0.1 XLM
- Plan creation: ~0.05 XLM per plan

### Operation Costs
- Subscribe: ~0.1 XLM + token transfer fees
- Renew: ~0.1 XLM + token transfer fees
- Cancel: ~0.1 XLM + refund transfer fees
- Pause/Resume: ~0.05 XLM
- Plan change: ~0.1 XLM + transfer fees

## Security Checklist

- [ ] Contract deployed from secure admin account
- [ ] Admin keys stored securely (hardware wallet recommended)
- [ ] Token contract verified and trusted
- [ ] Grace period configured appropriately
- [ ] Plan prices set correctly (consider token decimals)
- [ ] Test all operations on testnet first
- [ ] Monitor contract events for suspicious activity
- [ ] Set up automated renewal system
- [ ] Implement user notification system
- [ ] Regular backup of subscription data
- [ ] Emergency pause mechanism (if needed)

## Troubleshooting

### Common Issues

1. **"Already initialized" error**
   - Contract can only be initialized once
   - Deploy a new instance if needed

2. **"Insufficient balance" error**
   - User needs to have enough tokens
   - Check token balance before subscribing

3. **"Plan not found" error**
   - Verify plan_id exists
   - Use `get_plan` to check plan details

4. **"User already has an active subscription" error**
   - User must cancel or wait for current subscription to expire
   - Or upgrade using `change_plan` instead

5. **Token approval issues**
   - Ensure user has approved contract to spend tokens
   - Check approval amount and expiration

## Rollback Plan

If issues arise after deployment:

1. **Pause New Subscriptions**: Update all plans to `is_active = false`
2. **Process Refunds**: Cancel active subscriptions with refunds
3. **Deploy Fixed Version**: Deploy new contract with fixes
4. **Migrate Data**: Transfer subscription data to new contract
5. **Resume Operations**: Reactivate plans on new contract

## Support and Resources

- Soroban Documentation: https://soroban.stellar.org/docs
- Stellar Discord: https://discord.gg/stellar
- Contract Repository: [Your repo URL]
- Issue Tracker: [Your issue tracker URL]

## Mainnet Deployment Checklist

Before deploying to mainnet:

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Testnet deployment successful
- [ ] User acceptance testing completed
- [ ] Monitoring system in place
- [ ] Automated renewal system tested
- [ ] Emergency procedures documented
- [ ] Team trained on operations
- [ ] User documentation prepared
- [ ] Support system ready
