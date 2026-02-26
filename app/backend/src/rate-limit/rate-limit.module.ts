import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AdvancedRateLimitMiddleware } from './middleware/advanced-rate-limit.middleware';
import { RateLimitService } from './providers/rate-limit.service';
import { CircuitBreakerService } from './providers/circuit-breaker.service';
import { DdosService } from './providers/ddos.service';
import { ApiKeyService } from './providers/api-key.service';
import { AbuseReportService } from './providers/abuse-report.service';
import { AdvancedQuotaService } from './services/advanced-quota.service';
import { ApiKeyManagementService } from './services/api-key-management.service';
import { AdvancedDdosService } from './services/advanced-ddos.service';
import { ApiUsageAnalyticsService } from './services/api-usage-analytics.service';
import { ApiGatewayService } from './services/api-gateway.service';
import { RateLimitManagementController } from './controllers/rate-limit-management.controller';
import { ApiQuota } from './entities/api-quota.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiUsageLog } from './entities/api-usage-log.entity';
import { BlockedIp } from './entities/blocked-ip.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiQuota, ApiKey, ApiUsageLog, BlockedIp]),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 20,
        },
      ],
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [RateLimitManagementController],
  providers: [
    RateLimitGuard,
    AdvancedRateLimitMiddleware,
    RateLimitService,
    CircuitBreakerService,
    DdosService,
    ApiKeyService,
    AbuseReportService,
    AdvancedQuotaService,
    ApiKeyManagementService,
    AdvancedDdosService,
    ApiUsageAnalyticsService,
    ApiGatewayService,
  ],
  exports: [
    RateLimitService,
    AdvancedQuotaService,
    ApiKeyManagementService,
    AdvancedDdosService,
    ApiUsageAnalyticsService,
    ApiGatewayService,
    AdvancedRateLimitMiddleware,
  ],
})
export class RateLimitModule { }
