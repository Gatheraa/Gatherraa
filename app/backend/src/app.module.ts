import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VersioningMiddleware } from './common/middleware/versioning.middleware';
import { IdentityVerificationModule } from './identity-verification/identity-verification.module';
import { HealthModule } from './health/health.module';

import { IdentityVerification } from './identity-verification/entities/identity-verification.entity';
import { VerificationHistory } from './identity-verification/entities/verification-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.get<string>('DATABASE_PATH', ':memory:'),
        entities: [IdentityVerification, VerificationHistory],
        synchronize: true,
        retryAttempts: 0,
        // Pool sizing — defaults are conservative but tunable via env
        extra: {
          min: config.get<number>('DATABASE_POOL_MIN', 2),
          max: config.get<number>('DATABASE_POOL_MAX', 10),
          idleTimeoutMillis: config.get<number>('IDLE_TIMEOUT_MS', 30_000),
          connectionTimeoutMillis: config.get<number>('STATEMENT_TIMEOUT_MS', 5_000),
          maxLifetimeSeconds: config.get<number>('MAX_LIFETIME_MS', 3_600_000) / 1000,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    IdentityVerificationModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersioningMiddleware).forRoutes('*');
  }
}
