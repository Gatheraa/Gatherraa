import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from './services/user-tier-rate-limit.service';
import { RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from './rate-limit.config';
import { RateLimitStore } from './stores/store.interface';
import { MemoryStore } from './stores/memory.store';
import { RedisStore } from './stores/redis.store';

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
  providers: [
    RateLimitGuard,
    RateLimitService,
    RateLimitMonitoringService,
    UserTierRateLimitService,
    {
      provide: DEFAULT_RATE_LIMIT_CONFIG,
      useValue: DEFAULT_RATE_LIMIT_CONFIG,
    },
  ],
  exports: [
    RateLimitGuard,
    RateLimitService,
    RateLimitMonitoringService,
    UserTierRateLimitService,
  ],
})
export class RateLimitModule {}
