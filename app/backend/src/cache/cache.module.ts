import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AdvancedCacheService } from './services/advanced-cache.service';
import { CacheWarmupService } from './services/cache-warmup.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CachePerformanceService } from './services/cache-performance.service';
import { MultiLevelCacheService } from './services/multi-level-cache.service';
import { CacheSerializationService } from './services/cache-serialization.service';
import { CacheAnalyticsService } from './services/cache-analytics.service';
import { CacheFallbackService } from './services/cache-fallback.service';
import { CacheManagementController } from './controllers/cache-management.controller';
import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { Category } from '../categories/entities/category.entity';
import { RedisAdapterService } from '../notifications/providers/redis-adapter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Event, Category]),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [CacheManagementController],
  providers: [
    AdvancedCacheService,
    CacheWarmupService,
    CacheInvalidationService,
    CachePerformanceService,
    MultiLevelCacheService,
    CacheSerializationService,
    CacheAnalyticsService,
    CacheFallbackService,
    RedisAdapterService,
  ],
  exports: [
    AdvancedCacheService,
    CacheWarmupService,
    CacheInvalidationService,
    CachePerformanceService,
    MultiLevelCacheService,
    CacheSerializationService,
    CacheAnalyticsService,
    CacheFallbackService,
  ],
})
export class CacheModule {}
