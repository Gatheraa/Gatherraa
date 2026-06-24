import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VersioningMiddleware } from './common/middleware/versioning.middleware';
import { IdentityVerificationModule } from './identity-verification/identity-verification.module';

import { IdentityVerification } from './identity-verification/entities/identity-verification.entity';
import { VerificationHistory } from './identity-verification/entities/verification-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [IdentityVerification, VerificationHistory],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    IdentityVerificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersioningMiddleware).forRoutes('*');
  }
}
