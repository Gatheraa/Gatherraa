import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from './services/user-tier-rate-limit.service';
import { RateLimitMetricsService } from './services/rate-limit-metrics.service';
import { MetricsController } from './controllers/metrics.controller';
import { DEFAULT_RATE_LIMIT_CONFIG } from './rate-limit.config';
import { MemoryStore } from './stores/memory.store';

@Module({
  imports: [
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
  controllers: [MetricsController],
  providers: [
    MemoryStore,
    RateLimitGuard,
    RateLimitService,
    RateLimitMonitoringService,
    UserTierRateLimitService,
    RateLimitMetricsService,
    {
      provide: DEFAULT_RATE_LIMIT_CONFIG,
      useValue: DEFAULT_RATE_LIMIT_CONFIG,
    },
  ],
  exports: [
    MemoryStore,
    RateLimitGuard,
    RateLimitService,
    RateLimitMonitoringService,
    UserTierRateLimitService,
    RateLimitMetricsService,
  ],
})
export class RateLimitModule {}
