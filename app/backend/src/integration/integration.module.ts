import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IntegrationController } from './controllers/integration.controller';
import { IntegrationService } from './services/integration.service';
import { ApiGatewayService } from './services/api-gateway.service';
import { WebhookService } from './services/webhook.service';
import { DataMappingService } from './services/data-mapping.service';
import { IntegrationAnalyticsService } from './services/integration-analytics.service';
import { IntegrationSecurityService } from './services/integration-security.service';
import { LmsIntegrationService } from './services/lms-integration.service';
import { IntegrationMarketplaceService } from './services/integration-marketplace.service';
import { IntegrationTestingService } from './services/integration-testing.service';
import { Integration } from './entities/integration.entity';
import { IntegrationLog } from './entities/integration-log.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { DataMappingRule } from './entities/data-mapping-rule.entity';
import { IntegrationMetrics } from './entities/integration-metrics.entity';
import { LmsConnection } from './entities/lms-connection.entity';
import { MarketplacePlugin } from './entities/marketplace-plugin.entity';
import { IntegrationTestResult } from './entities/integration-test-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Integration,
      IntegrationLog,
      WebhookEvent,
      DataMappingRule,
      IntegrationMetrics,
      LmsConnection,
      MarketplacePlugin,
      IntegrationTestResult,
    ]),
    ConfigModule,
  ],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    ApiGatewayService,
    WebhookService,
    DataMappingService,
    IntegrationAnalyticsService,
    IntegrationSecurityService,
    LmsIntegrationService,
    IntegrationMarketplaceService,
    IntegrationTestingService,
  ],
  exports: [
    IntegrationService,
    ApiGatewayService,
    WebhookService,
    DataMappingService,
    IntegrationAnalyticsService,
    IntegrationSecurityService,
    LmsIntegrationService,
    IntegrationMarketplaceService,
    IntegrationTestingService,
  ],
})
export class IntegrationModule {}
