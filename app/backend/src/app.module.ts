import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VersioningMiddleware } from './common/middleware/versioning.middleware';
import { IdentityVerificationModule } from './identity-verification/identity-verification.module';
import { HealthModule } from './health/health.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

import { IdentityVerification } from './identity-verification/entities/identity-verification.entity';
import { VerificationHistory } from './identity-verification/entities/verification-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV', 'development');
        const isProduction = nodeEnv === 'production';
        const isTest = nodeEnv === 'test';
        // In production and non-test environments, synchronize must be false
        // Allow explicit opt-in only in non-production environments when DB_SYNCHRONIZE=true or in test mode
        const allowSync =
          !isProduction &&
          (isTest || config.get<string>('DB_SYNCHRONIZE') === 'true');
        return {
          type: 'sqlite',
          database: config.get<string>('DATABASE_PATH', ':memory:'),
          entities: [IdentityVerification, VerificationHistory],
          synchronize: allowSync,
          migrationsRun: !allowSync,
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          retryAttempts: 0,
          // Pool sizing — defaults are conservative but tunable via env
          extra: {
            min: config.get<number>('DATABASE_POOL_MIN', 2),
            max: config.get<number>('DATABASE_POOL_MAX', 10),
            idleTimeoutMillis: config.get<number>('IDLE_TIMEOUT_MS', 30_000),
            connectionTimeoutMillis: config.get<number>(
              'STATEMENT_TIMEOUT_MS',
              5_000,
            ),
            maxLifetimeSeconds:
              config.get<number>('MAX_LIFETIME_MS', 3_600_000) / 1000,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    IdentityVerificationModule,
    HealthModule,
    RateLimitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersioningMiddleware).forRoutes('*');
  }
}
