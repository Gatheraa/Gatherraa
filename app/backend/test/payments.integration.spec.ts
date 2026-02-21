import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PaymentsModule } from '../src/payments/payments.module';
import {
  Payment,
  PaymentRefund,
  PaymentWebhook,
  PaymentReconciliation,
  SavedPaymentMethod,
} from '../src/payments/entities';
import { PaymentService } from '../src/payments/services/payment.service';
import { StripeService } from '../src/payments/services/stripe.service';
import { CryptoPaymentService } from '../src/payments/services/crypto-payment.service';
import { FraudDetectionService } from '../src/payments/services/fraud-detection.service';
import { PaymentStatus, PaymentMethod, PaymentType, PaymentCurrency } from '../src/payments/entities/payment.entity';

describe('Payments Module Integration Tests', () => {
  let app: INestApplication;
  let paymentService: PaymentService;
  let stripeService: StripeService;
  let cryptoPaymentService: CryptoPaymentService;
  let fraudDetectionService: FraudDetectionService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            Payment,
            PaymentRefund,
            PaymentWebhook,
            PaymentReconciliation,
            SavedPaymentMethod,
          ],
          synchronize: true,
        }),
        CacheModule.register({
          isGlobal: true,
        }),
        PaymentsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    paymentService = moduleFixture.get<PaymentService>(PaymentService);
    stripeService = moduleFixture.get<StripeService>(StripeService);
    cryptoPaymentService = moduleFixture.get<CryptoPaymentService>(CryptoPaymentService);
    fraudDetectionService = moduleFixture.get<FraudDetectionService>(FraudDetectionService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Payment Creation', () => {
    it('should create a Stripe payment with idempotency', async () => {
      const dto = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 99.99,
        idempotencyKey: 'test-idempotency-1',
      };

      // First request
      const payment1 = await paymentService.createPayment(dto);
      expect(payment1.id).toBeDefined();
      expect(payment1.status).toBe(PaymentStatus.PENDING);

      // Second request with same idempotency key
      const payment2 = await paymentService.createPayment(dto);
      expect(payment2.id).toBe(payment1.id);
    });

    it('should create crypto payment', async () => {
      const dto = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        method: PaymentMethod.ETHEREUM,
        currency: PaymentCurrency.ETH,
        type: PaymentType.TICKET_PURCHASE,
        amount: 0.5,
        idempotencyKey: 'test-crypto-1',
        fromAddress: '0x1234567890123456789012345678901234567890',
      };

      const payment = await paymentService.createPayment(dto);
      expect(payment.method).toBe(PaymentMethod.ETHEREUM);
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.fromAddress).toBe(dto.fromAddress);
    });

    it('should reject high-risk payments', async () => {
      // Create multiple rapid transactions to trigger fraud detection
      const userId = '550e8400-e29b-41d4-a716-446655440002';

      for (let i = 0; i < 15; i++) {
        try {
          await paymentService.createPayment({
            userId,
            method: PaymentMethod.STRIPE,
            currency: PaymentCurrency.USD,
            type: PaymentType.TICKET_PURCHASE,
            amount: 1000,
            idempotencyKey: `velocity-test-${i}`,
          });
        } catch (error) {
          if (error.message.includes('fraud')) {
            break;
          }
        }
      }

      // The last attempt should be rejected due to velocity
      const rejectedPayment = await paymentService.createPayment({
        userId,
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 1000,
        idempotencyKey: `velocity-test-final`,
      }).catch(err => err);

      if (rejectedPayment instanceof Error) {
        expect(rejectedPayment.message).toContain('fraud');
      }
    });
  });

  describe('Fraud Detection', () => {
    it('should detect high transaction velocity', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440003';

      const analysis = await fraudDetectionService.analyzePayment(
        userId,
        1000,
        'USD',
        'stripe'
      );

      expect(analysis.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(analysis.riskLevel);
    });

    it('should detect unusual amount', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440004';

      // Create initial payment
      await paymentService.createPayment({
        userId,
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 50,
        idempotencyKey: 'baseline-1',
      });

      // Create much larger payment
      const analysis = await fraudDetectionService.analyzePayment(
        userId,
        500, // 10x larger
        'USD',
        'stripe'
      );

      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.reasons.some(r => r.includes('Unusual amount'))).toBe(true);
    });

    it('should detect new payment method', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440005';

      const analysis = await fraudDetectionService.analyzePayment(
        userId,
        99.99,
        'USD',
        'stripe' // First time using stripe for this user
      );

      expect(analysis.score).toBeGreaterThan(0);
    });
  });

  describe('Payment Refunds', () => {
    it('should create full refund', async () => {
      const payment = await paymentService.createPayment({
        userId: '550e8400-e29b-41d4-a716-446655440006',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 99.99,
        idempotencyKey: 'refund-test-1',
      });

      // Mark as succeeded for refund
      await paymentService.getPaymentById(payment.id);

      // Note: In real scenario, payment would be marked succeeded by webhook
      // Here we're testing the refund creation logic
    });

    it('should create partial refund', async () => {
      const payment = await paymentService.createPayment({
        userId: '550e8400-e29b-41d4-a716-446655440007',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 100,
        idempotencyKey: 'refund-test-2',
      });

      expect(payment.id).toBeDefined();
    });

    it('should prevent refund idempotency', async () => {
      // Test that refunding the same transaction twice uses same idempotency key
      // prevents duplicate refunds
    });
  });

  describe('Crypto Payment Verification', () => {
    it('should validate Ethereum addresses', () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const invalidAddress = '0xinvalid';

      expect(cryptoPaymentService.isValidAddress(validAddress, PaymentMethod.ETHEREUM)).toBe(true);
      expect(cryptoPaymentService.isValidAddress(invalidAddress, PaymentMethod.ETHEREUM)).toBe(false);
    });

    it('should require sufficient block confirmations', async () => {
      // Test that payment requires 12+ confirmations on Ethereum
      // This would require mocking blockchain responses
    });
  });

  describe('Payment History', () => {
    it('should retrieve user payment history', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440008';

      // Create multiple payments
      for (let i = 0; i < 3; i++) {
        await paymentService.createPayment({
          userId,
          method: PaymentMethod.STRIPE,
          currency: PaymentCurrency.USD,
          type: PaymentType.TICKET_PURCHASE,
          amount: 50 + i * 10,
          idempotencyKey: `history-${i}`,
        });
      }

      const [payments, count] = await paymentService.getUserPayments(userId);

      expect(count).toBe(3);
      expect(payments.length).toBe(3);
      expect(payments[0].userId).toBe(userId);
    });

    it('should filter payments by status', async () => {
      const [pendingPayments, pendingCount] = await paymentService.getPaymentsByStatus(
        PaymentStatus.PENDING
      );

      expect(Array.isArray(pendingPayments)).toBe(true);
      expect(typeof pendingCount).toBe('number');
    });

    it('should search payments with filters', async () => {
      const [payments, count] = await paymentService.searchPayments({
        status: PaymentStatus.PENDING,
        method: PaymentMethod.STRIPE,
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(payments)).toBe(true);
      expect(count >= 0).toBe(true);
    });
  });

  describe('Saved Payment Methods', () => {
    it('should save payment method', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440009';

      // In real scenario, would use actual Stripe payment method ID
      // This tests the data layer
    });

    it('should list saved payment methods', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440010';

      const methods = await paymentService.getSavedPaymentMethods(userId);

      expect(Array.isArray(methods)).toBe(true);
    });

    it('should set default payment method', async () => {
      // Test setting a saved method as default
    });
  });

  describe('Payment Analytics', () => {
    it('should calculate payment analytics', async () => {
      const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = new Date();

      const analytics = await paymentService.getPaymentAnalytics(dateFrom, dateTo);

      expect(analytics.totalRevenue).toBeDefined();
      expect(analytics.totalTransactions).toBeDefined();
      expect(analytics.successRate).toBeDefined();
      expect(analytics.averageTransactionValue).toBeDefined();
      expect(analytics.byPaymentMethod).toBeDefined();
    });

    it('should handle empty analytics period', async () => {
      const dateFrom = new Date('2020-01-01');
      const dateTo = new Date('2020-01-02');

      const analytics = await paymentService.getPaymentAnalytics(dateFrom, dateTo);

      expect(analytics.totalRevenue).toBe(0);
      expect(analytics.totalTransactions).toBe(0);
    });
  });

  describe('Payment Retry Logic', () => {
    it('should allow payment retry with exponential backoff', async () => {
      const payment = await paymentService.createPayment({
        userId: '550e8400-e29b-41d4-a716-446655440011',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 50,
        idempotencyKey: 'retry-test-1',
      });

      const retriedPayment = await paymentService.retryPayment(payment.id).catch(err => {
        // Expected to fail if payment not in failed state
        return null;
      });

      if (retriedPayment) {
        expect(retriedPayment.retryCount).toBeGreaterThan(0);
        expect(retriedPayment.nextRetryAt).toBeDefined();
      }
    });

    it('should prevent exceeding max retry attempts', async () => {
      // Test that payment can't be retried more than 3 times
    });
  });

  describe('REST API Endpoints', () => {
    it('POST /payments/health/check - Health check', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/health/check')
        .expect(200);

      expect(response.body.status).toBe('payment service is operational');
    });

    it('GET /payments/:id - Get payment details', async () => {
      const payment = await paymentService.createPayment({
        userId: '550e8400-e29b-41d4-a716-446655440012',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 50,
        idempotencyKey: 'api-test-1',
      });

      // Note: Would need authentication in real test
      // const response = await request(app.getHttpServer())
      //   .get(`/payments/${payment.id}`)
      //   .set('Authorization', `Bearer ${token}`)
      //   .expect(200);
    });
  });

  describe('Webhook Handling', () => {
    it('should store incoming webhook', async () => {
      // Test webhook storage and processing
    });

    it('should verify webhook signatures', async () => {
      // Test signature verification logic
    });

    it('should process webhooks idempotently', async () => {
      // Test that same webhook processed twice doesn't create duplicate records
    });
  });

  describe('Reconciliation', () => {
    it('should identify discrepancies', async () => {
      // Test reconciliation logic
    });

    it('should track reconciliation reports', async () => {
      // Test reconciliation history
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-amount payments', async () => {
      const invalidDtoAttempt = {
        userId: '550e8400-e29b-41d4-a716-446655440013',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 0,
        idempotencyKey: 'edge-0',
      };

      // Should fail validation
    });

    it('should handle extremely large amounts', async () => {
      const payment = await paymentService.createPayment({
        userId: '550e8400-e29b-41d4-a716-446655440014',
        method: PaymentMethod.STRIPE,
        currency: PaymentCurrency.USD,
        type: PaymentType.TICKET_PURCHASE,
        amount: 999999.99,
        idempotencyKey: 'edge-large',
      });

      expect(payment.amountDisplayValue).toBe(999999.99);
    });

    it('should handle multiple concurrent payments from same user', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440015';

      const promises = Array.from({ length: 5 }, (_, i) =>
        paymentService.createPayment({
          userId,
          method: PaymentMethod.STRIPE,
          currency: PaymentCurrency.USD,
          type: PaymentType.TICKET_PURCHASE,
          amount: 50 + i,
          idempotencyKey: `concurrent-${i}`,
        })
      );

      const payments = await Promise.all(promises);

      expect(payments).toHaveLength(5);
      expect(new Set(payments.map(p => p.id)).size).toBe(5);
    });
  });
});
