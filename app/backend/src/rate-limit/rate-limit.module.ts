import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitMonitoringService } from './services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from './services/user-tier-rate-limit.service';
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
  providers: [
    RateLimitGuard,
    RateLimitService,
    MemoryStore,
    RateLimitMonitoringService,
    UserTierRateLimitService,
  ],
  exports: [
    RateLimitGuard,
    RateLimitService,
    MemoryStore,
    RateLimitMonitoringService,
    UserTierRateLimitService,
  ],
})
export class RateLimitModule {}
