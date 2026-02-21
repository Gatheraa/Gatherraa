import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import {
  Payment,
  PaymentRefund,
  PaymentWebhook,
  PaymentReconciliation,
  SavedPaymentMethod,
} from './entities';
import {
  StripeService,
  CryptoPaymentService,
  FraudDetectionService,
  PaymentService,
  ReconciliationService,
} from './services';
import { PaymentController } from './controllers/payment.controller';
import { PaymentWebhookController } from './webhooks/payment-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentRefund,
      PaymentWebhook,
      PaymentReconciliation,
      SavedPaymentMethod,
    ]),
    ConfigModule,
    CacheModule.register(),
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    StripeService,
    CryptoPaymentService,
    FraudDetectionService,
    PaymentService,
    ReconciliationService,
  ],
  exports: [PaymentService, StripeService, CryptoPaymentService, ReconciliationService],
})
export class PaymentsModule {}
