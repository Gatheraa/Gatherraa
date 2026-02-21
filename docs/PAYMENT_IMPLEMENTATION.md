# Payment Processing Service - Implementation Guide

## Overview

A comprehensive, production-ready payment processing service supporting both fiat (Stripe) and cryptocurrency payments with:
- Full webhook handling and idempotency
- Real-time payment reconciliation
- Fraud detection and prevention
- Complete refund processing
- Multi-currency support
- Delivery guarantees with retry logic

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Payment Service                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Stripe     │  │   Crypto     │  │   Fraud      │          │
│  │   Service    │  │   Service    │  │   Detection  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐           │
│  │        Main Payment Service & Orchestration      │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Webhook    │  │Reconciliation│  │   Analytics  │          │
│  │   Handler    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐           │
│  │            Database & Cache Layer                │           │
│  │  (TypeORM + SQLite + Redis)                      │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Payment Entity
- Tracks all payment transactions
- Supports Stripe and crypto payments
- Includes fraud analysis and provider responses
- Retry and webhook tracking

### PaymentRefund Entity
- Full and partial refund support
- Status tracking (pending, processing, succeeded, failed)
- Idempotency keys for safe retries
- Provider integration fields

### PaymentWebhook Entity
- Stores incoming webhook events
- Signature verification
- Retry tracking
- Supports Stripe, blockchain, and Coinbase webhooks

### PaymentReconciliation Entity
- Daily reconciliation reports
- Discrepancy tracking
- Provider balance verification
- Audit trail

### SavedPaymentMethod Entity
- Tokenized payment methods
- Support for cards, bank accounts, wallets
- Default method management
- Stripe integration

### NotificationAnalytics Entity
- Payment metrics and KPIs
- Success/failure rates
- Revenue tracking
- Payment method analysis

## Key Features

### 1. Fiat Payment Processing (Stripe)

```bash
# Initiate payment
curl -X POST http://localhost:3000/payments/stripe/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "amount": 99.99,
    "currency": "USD",
    "type": "ticket_purchase",
    "description": "Event ticket purchase",
    "idempotencyKey": "unique-key-123"
  }'

# Response
{
  "clientSecret": "pi_test_secret_xyz",
  "paymentIntentId": "pi_test_xyz"
}

# On client side, use Stripe.js to confirm payment with clientSecret
```

### 2. Cryptocurrency Payment Processing

```bash
# Initiate crypto payment
curl -X POST http://localhost:3000/payments/crypto/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "amount": 0.5,
    "method": "ethereum",
    "type": "ticket_purchase",
    "fromAddress": "0x1234...",
    "saveWallet": true,
    "idempotencyKey": "unique-key-456"
  }'

# Response
{
  "id": "payment-uuid",
  "paymentAddress": "0x9876...",
  "amount": 0.5,
  "fromAddress": "0x1234...",
  "currency": "ETH"
}

# User sends ETH to paymentAddress
# Then verify transaction
curl -X POST http://localhost:3000/payments/crypto/verify \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment-uuid",
    "transactionHash": "0x5678...",
    "blockConfirmations": 12
  }'
```

### 3. Idempotency & Delivery Guarantees

Every request that creates a payment or refund supports idempotency:

```bash
# Same request with same idempotency key returns same result
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "userId": "user-uuid",
    "amount": 50.00,
    "currency": "USD",
    "method": "stripe",
    "type": "ticket_purchase",
    "idempotencyKey": "unique-1234"
  }'

# Second request with same idempotencyKey returns same payment
# (No duplicate charges)
```

### 4. Fraud Detection

Automatic fraud analysis on every payment:

```typescript
// Checks:
// - Transaction velocity (multiple transactions in short time)
// - Geographic velocity (transactions from different locations)
// - Unusual amounts (3-10x user average)
// - New payment methods
// - High-risk countries
// - Currency changes
// - IP reputation

// Risk levels: low (score 0-20), medium (20-50), high (50-100)
// High-risk payments are rejected automatically
```

### 5. Webhook Handling

```bash
# Stripe webhooks automatically update payment status
# POST /webhooks/payments/stripe

# Blockchain webhooks track confirmations  
# POST /webhooks/payments/blockchain

# All webhooks verify signatures and handle idempotently
```

### 6. Refund Processing

```bash
# Full refund
curl -X POST http://localhost:3000/payments/:paymentId/refund \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "reason": "Customer requested",
    "idempotencyKey": "refund-123"
  }'

# Partial refund
curl -X POST http://localhost:3000/payments/:paymentId/refund \
  -d '{
    "amount": 25.00,
    "reason": "Partial refund",
    "notes": "Admin approved",
    "idempotencyKey": "refund-456"
  }'
```

### 7. Payment Reconciliation

```bash
# Automatic daily reconciliation
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async reconcileStripeDaily()

# Or trigger manually
curl -X POST http://localhost:3000/payments/reconciliation/run \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "provider": "stripe"
  }'

# Get reconciliation report
curl -X GET http://localhost:3000/payments/reconciliation/reports \
  -H "Authorization: Bearer TOKEN"
```

### 8. Payment Preferences & Saved Methods

```bash
# Save payment method
curl -X POST http://localhost:3000/payments/methods/save \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "type": "card",
    "nickname": "My Visa",
    "stripePaymentMethodId": "pm_123...",
    "setAsDefault": true
  }'

# Get saved methods
curl -X GET http://localhost:3000/payments/methods \
  -H "Authorization: Bearer TOKEN"

# Set default method
curl -X PUT http://localhost:3000/payments/methods/:methodId \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "isDefault": true }'

# Delete method
curl -X DELETE http://localhost:3000/payments/methods/:methodId \
  -H "Authorization: Bearer TOKEN"
```

## Configuration

### Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Blockchain RPC Endpoints
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/key
POLYGON_RPC_URL=https://polygon-rpc.com
BITCOIN_RPC_URL=https://bitcoin-rpc-url

# Contract Addresses
ETHEREUM_CONTRACT_ADDRESS=0x1234...
USDC_CONTRACT_ADDRESS=0x5678...
MATIC_CONTRACT_ADDRESS=0x9abc...

# Fraud Detection
MAXMIND_LICENSE_KEY=your-key
FRAUD_RISK_THRESHOLD=50

# Reconciliation
RECONCILIATION_SCHEDULE=0 2 * * *  # 2 AM daily

# Redis (for caching and fraud detection)
REDIS_URL=redis://localhost:6379
```

## Integration Examples

### In Events Module

```typescript
// When ticket is purchased
async purchaseTicket(ticketId: string, userId: string) {
  const ticket = await this.ticketRepository.findOne(ticketId);
  
  const payment = await this.paymentService.createPayment({
    userId,
    method: 'stripe',
    currency: 'USD',
    type: PaymentType.TICKET_PURCHASE,
    amount: ticket.price,
    ticketId: ticket.id,
    eventId: ticket.eventId,
    metadata: {
      description: `Ticket for ${ticket.event.name}`,
      orderId: ticket.id,
    }
  });

  return payment;
}
```

### In User Module

```typescript
// Enhanced user profile with payment info
async getUserWithPaymentHistory(userId: string) {
  const user = await this.userRepository.findOne(userId);
  const [payments, count] = await this.paymentService.getUserPayments(userId);
  
  return {
    ...user,
    paymentHistory: payments,
    totalSpent: payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amountDisplayValue, 0),
    paymentMethods: await this.paymentService.getSavedPaymentMethods(userId),
  };
}
```

## Testing

### Unit Tests

```bash
npm test -- payments.service.spec
npm test -- stripe.service.spec
npm test -- crypto-payment.service.spec
npm test -- fraud-detection.service.spec
```

### Integration Tests

```bash
npm run test:e2e -- payments.integration.spec
```

### Manual Testing

```bash
# Create test payment
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer test-token" \
  -d '{...}'

# Test webhook
curl -X POST http://localhost:3000/webhooks/payments/stripe \
  -H "Stripe-Signature: t=xxx,v1=yyy" \
  -d '{...}'

# View payment status
curl -X GET http://localhost:3000/payments/:id \
  -H "Authorization: Bearer test-token"
```

## Performance Considerations

1. **Database Indexing**: All frequently queried fields are indexed
2. **Caching**: Fraud detection uses Redis for velocity checks
3. **Async Processing**: Webhooks processed asynchronously
4. **Batch Operations**: Reconciliation runs as scheduled job
5. **Connection Pooling**: Stripe and blockchain connections pooled

## Security Features

1. **Webhook Signature Verification**: Every webhook verified with provider signature
2. **Idempotency Keys**: Prevent duplicate charges and refunds
3. **Rate Limiting**: Built-in rate limiting per user
4. **Fraud Detection**: Multi-layer fraud analysis
5. **PCI Compliance**: No card data stored (Stripe tokenization)
6. **Encryption**: Sensitive data encrypted at rest
7. **Audit Trail**: All payment operations logged

## Monitoring & Analytics

```bash
# Get payment analytics
curl -X GET 'http://localhost:3000/payments/analytics/summary?dateFrom=2024-01-01&dateTo=2024-01-31' \
  -H "Authorization: Bearer TOKEN"

# Response
{
  "totalRevenue": 15234.50,
  "totalTransactions": 234,
  "successRate": 98.3,
  "averageTransactionValue": 65.10,
  "byPaymentMethod": {
    "stripe": 12000.00,
    "ethereum": 3234.50
  }
}
```

## Troubleshooting

### Payment Stuck in Pending

1. Check webhook processing: `GET /webhooks/payments/status/:id`
2. Verify provider credentials in `.env`
3. Check Redis connection for crypto tracking
4. Review error logs for specific errors

### Fraud Detection Blocking Legitimate Payments

1. Review fraud analysis: `GET /payments/:id` → `fraudAnalysis`
2. Whitelist IP addresses or locations as needed
3. Adjust risk thresholds in configuration
4. Analyze patterns to fine-tune rules

### Reconciliation Discrepancies

1. Check `PaymentReconciliation` records
2. Review discrepancy details and types
3. Investigate provider's transaction records
4. Escalate to payment operations team

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments` | Create payment |
| GET | `/payments/:id` | Get payment details |
| GET | `/payments/user/:userId/history` | Get payment history |
| POST | `/payments/stripe/initiate` | Initiate Stripe payment |
| POST | `/payments/stripe/confirm` | Confirm Stripe payment |
| POST | `/payments/crypto/initiate` | Initiate crypto payment |
| POST | `/payments/crypto/verify` | Verify crypto transaction |
| POST | `/payments/:id/refund` | Create refund |
| GET | `/payments/:id/refunds` | Get refunds for payment |
| POST | `/payments/:id/retry` | Retry failed payment |
| POST | `/payments/methods/save` | Save payment method |
| GET | `/payments/methods` | Get saved methods |
| PUT | `/payments/methods/:id` | Update payment method |
| DELETE | `/payments/methods/:id` | Delete payment method |
| GET | `/payments/analytics/summary` | Get analytics |
| GET | `/payments/reconciliation/reports` | Get reconciliation reports |
| POST | `/payments/reconciliation/run` | Run reconciliation manually |
| POST | `/webhooks/payments/stripe` | Stripe webhook endpoint |
| POST | `/webhooks/payments/blockchain` | Blockchain webhook endpoint |

## Next Steps

1. **Deploy**: Push to production environment
2. **Setup Webhooks**: Configure Stripe and blockchain event subscriptions
3. **Monitor**: Set up alerts for failed payments and reconciliation issues
4. **Test**: Run comprehensive test suite against staging
5. **Document**: Create internal wiki with operational procedures
6. **Train**: Onboard team on payment processing operations

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Payment card industry standards](https://www.pcisecuritystandards.org/)
