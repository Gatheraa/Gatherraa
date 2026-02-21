import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantMiddleware } from './middleware';

@Module({
  controllers: [TenantController],
  providers: [TenantService, TenantConnectionService],
})
export class TenantModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*'); // apply to all routes
  }
}