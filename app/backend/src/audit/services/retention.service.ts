import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { S3AuditService } from './s3-audit.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private s3AuditService: S3AuditService,
    private configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get<number>('AUDIT_RETENTION_DAYS') || 90;
  }

  /**
   * Run every night at midnight to archive and cleanup old logs
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRetention() {
    this.logger.log('Starting audit log retention job...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const oldLogs = await this.auditLogRepository.find({
      where: {
        createdAt: LessThan(cutoffDate),
      },
      take: 1000, // Batch process 1000 logs at a time
    });

    if (oldLogs.length === 0) {
      this.logger.log('No logs to archive.');
      return;
    }

    const batchId = Date.now().toString();
    const archived = await this.s3AuditService.archiveLogs(oldLogs, batchId);

    if (archived) {
      const ids = oldLogs.map(log => log.id);
      await this.auditLogRepository.delete(ids);
      this.logger.log(`Archived and deleted ${oldLogs.length} old audit logs.`);
    } else {
      this.logger.error('Failed to archive logs. Skipping deletion for safety.');
    }
  }
}
