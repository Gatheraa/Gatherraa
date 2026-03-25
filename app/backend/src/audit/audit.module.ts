import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditController } from './controllers/audit.controller';
import { S3AuditService } from './services/s3-audit.service';
import { BlockchainAuditService } from './services/blockchain-audit.service';
import { RetentionService } from './services/retention.service';
import { ComplianceService } from './services/compliance.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    S3AuditService,
    BlockchainAuditService,
    RetentionService,
    ComplianceService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService, S3AuditService, BlockchainAuditService, ComplianceService],
})
export class AuditModule {}
