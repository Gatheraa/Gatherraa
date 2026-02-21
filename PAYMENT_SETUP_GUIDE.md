# Payment Service - Quick Setup Guide

## Installation (5 minutes)

### 1. Install Dependencies

```bash
cd app/backend
npm install
```

Installed packages:
- `stripe` - Stripe payment processing
- `ethers` - Ethereum and blockchain interaction
- `web3` - Web3.js for additional blockchain support
- `crypto-js` - Cryptographic operations
- `maxmind` - GeoIP for fraud detection

### 2. Configure Environment

Create `.env` file with:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_public_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Blockchain RPC Endpoints
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
POLYGON_RPC_URL=https://polygon-rpc.com
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key

# Smart Contract Addresses (Mainnet)
ETHEREUM_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
USDC_CONTRACT_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
MATIC_CONTRACT_ADDRESS=0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0

# Fraud Detection
MAXMIND_LICENSE_KEY=your_maxmind_license_key
FRAUD_RISK_THRESHOLD=50

# Redis (for velocity checks and caching)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_PATH=./database.sqlite

# Environment
NODE_ENV=development
PORT=3000
```

### 3. Start Application

```bash
npm run start:dev
```

### 4. Verify Installation

```bash
# Check payment service health
curl http://localhost:3000/payments/health/check

# Should return: {"status":"payment service is operational"}
```

## Quick Test

### Create a Test Payment

```bash
# 1. Get a JWT token first (from auth endpoint)
TOKEN="your-jwt-token"

# 2. Initiate Stripe payment
curl -X POST http://localhost:3000/payments/stripe/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 99.99,
    "currency": "USD",
    "type": "ticket_purchase",
    "description": "Test Event Ticket"
  }'

# Response will include clientSecret for frontend confirmation
```

### Setup Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → Webhooks
3. Add endpoint: `https://yourdomain.com/webhooks/payments/stripe`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`

### Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/webhooks/payments/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

## Database Setup

The payment entities are automatically created by TypeORM on startup:

- `payments` - Main payment records  
- `payment_refunds` - Refund tracking
- `payment_webhooks` - Webhook event log
- `payment_reconciliation` - Daily reconciliation reports
- `saved_payment_methods` - Tokenized payment methods

To verify:

```bash
sqlite3 database.sqlite ".tables"
# Should show: payments, payment_refunds, payment_webhooks, ...
```

## Common Integration Points

### In Tickets Module

```typescript
import { PaymentService } from '../payments/services/payment.service';

export class TicketsService {
  constructor(private paymentService: PaymentService) {}

  async purchaseTicket(userId: string, ticketId: string) {
    const ticket = await this.ticketRepository.findOne(ticketId);
    
    const payment = await this.paymentService.createPayment({
      userId,
      method: 'stripe',
      currency: 'USD',
      type: 'ticket_purchase',
      amount: ticket.price,
      ticketId: ticket.id,
    });

    return payment;
  }
}
```

### In Events Module

```typescript
import { PaymentService } from '../payments/services/payment.service';

export class EventsService {
  constructor(private paymentService: PaymentService) {}

  async getEventAnalytics(eventId: string) {
    // Get revenue from payments
    const analytics = await this.paymentService.getPaymentAnalytics(
      startDate,
      endDate
    );
    
    return analytics;
  }
}
```

## Testing Payments

### Unit Tests

```bash
npm test -- payments.service
npm test -- stripe.service
npm test -- crypto-payment.service
npm test -- fraud-detection.service
```

### E2E Tests

```bash
npm run test:e2e -- payments.integration.spec
```

### Manual Test Scenarios

#### Scenario 1: Successful Stripe Payment

```bash
TOKEN="your-token"

# 1. Initiate
RESPONSE=$(curl -X POST http://localhost:3000/payments/stripe/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"550e8400-e29b-41d4-a716-446655440000","amount":50.00,"currency":"USD","type":"ticket_purchase"}')

PAYMENT_ID=$(echo $RESPONSE | jq -r '.paymentIntentId')

# 2. Confirm with Stripe (in production, done on frontend with Stripe.js)
curl -X POST http://localhost:3000/payments/stripe/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"paymentIntentId\":\"$PAYMENT_ID\"}"

# 3. Check payment status
curl -X GET http://localhost:3000/payments \
  -H "Authorization: Bearer $TOKEN"
```

#### Scenario 2: Crypto Payment

```bash
TOKEN="your-token"
USER_WALLET="0x1234567890123456789012345678901234567890"

# 1. Initiate crypto payment
curl -X POST http://localhost:3000/payments/crypto/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\":\"550e8400-e29b-41d4-a716-446655440000\",
    \"amount\":0.5,
    \"method\":\"ethereum\",
    \"type\":\"ticket_purchase\",
    \"fromAddress\":\"$USER_WALLET\"
  }"

# Get the payment address and wait for user to send ETH

# 2. Verify transaction after user sends ETH
curl -X POST http://localhost:3000/payments/crypto/verify \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paymentId":"payment-uuid",
    "transactionHash":"0xabcd1234...",
    "blockConfirmations":12
  }'
```

#### Scenario 3: Refund

```bash
TOKEN="your-token"
PAYMENT_ID="payment-uuid"

# Full refund
curl -X POST http://localhost:3000/payments/$PAYMENT_ID/refund \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reason":"Customer requested refund",
    "idempotencyKey":"refund-001"
  }'

# Check refund status
curl -X GET http://localhost:3000/payments/$PAYMENT_ID/refunds \
  -H "Authorization: Bearer $TOKEN"
```

## Key Files

| File | Purpose |
|------|---------|
| `src/payments/entities/` | Database schemas |
| `src/payments/dto/` | Data transfer objects |
| `src/payments/services/stripe.service.ts` | Stripe integration |
| `src/payments/services/crypto-payment.service.ts` | Blockchain integration |
| `src/payments/services/fraud-detection.service.ts` | Fraud analysis |
| `src/payments/services/payment.service.ts` | Main orchestration |
| `src/payments/services/reconciliation.service.ts` | Daily reconciliation |
| `src/payments/controllers/payment.controller.ts` | REST API endpoints |
| `src/payments/webhooks/payment-webhook.controller.ts` | Webhook handlers |

## Monitoring

### Check Payment Status

```bash
curl -X GET http://localhost:3000/payments/:paymentId \
  -H "Authorization: Bearer TOKEN"
```

### View Analytics

```bash
curl -X GET 'http://localhost:3000/payments/analytics/summary?dateFrom=2024-01-01&dateTo=2024-02-01' \
  -H "Authorization: Bearer TOKEN"
```

### View Reconciliation Reports

```bash
curl -X GET http://localhost:3000/payments/reconciliation/reports \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### Issue: Stripe Secret Key Error

**Solution**: Verify `STRIPE_SECRET_KEY` in `.env` starts with `sk_live_` or `sk_test_`

### Issue: Webhook Not Processing

**Solution**: 
- Verify webhook signature secret in `.env`
- Check webhook endpoint is publicly accessible
- Review webhook logs in Stripe Dashboard

### Issue: Crypto Transaction Not Confirming

**Solution**:
- Verify RPC endpoint is working: `curl $ETH_RPC_URL`
- Check transaction hash exists on blockchain
- Ensure sufficient block confirmations (12+ for Ethereum)

### Issue: Fraud Detection Blocking Legitimate Payments

**Solution**: Adjust `FRAUD_RISK_THRESHOLD` from 50 to higher value (60-70)

## Production Deployment

Before deploying to production:

1. ✅ Switch to live Stripe keys (`sk_live_*`, `pk_live_*`)
2. ✅ Update blockchain RPC endpoints to mainnet
3. ✅ Configure MAXMIND license key for fraud detection
4. ✅ Set up webhook endpoints in Stripe Dashboard
5. ✅ Enable HTTPS for all endpoints
6. ✅ Set `NODE_ENV=production`
7. ✅ Test webhook signature verification
8. ✅ Review and adjust fraud detection thresholds
9. ✅ Set up monitoring and alerting
10. ✅ Document incident response procedures

## Support

For detailed documentation, see: `docs/PAYMENT_IMPLEMENTATION.md`

For issues, check logs:

```bash
npm run start:dev 2>&1 | grep -i payment
```

## Next Steps

1. ✅ Set up Stripe account and get API keys
2. ✅ Configure blockchain RPC endpoints
3. ✅ Create test payments
4. ✅ Set up webhooks
5. ✅ Run test suite
6. ✅ Deploy to staging
7. ✅ Deploy to production

Happy payment processing! 💳💰
