import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../constants/audit.constants';
import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditSecret: string;
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: ConfigService,
  ) {
    this.auditSecret = this.configService.get<string>('AUDIT_LOG_SECRET') || 'default-secret-change-me';
    // Must be 32 bytes for aes-256-cbc
    const rawKey = this.configService.get<string>('AUDIT_ENCRYPTION_KEY') || '0123456789abcdef0123456789abcdef';
    this.encryptionKey = Buffer.from(rawKey);
  }

  async logEvent(data: {
    userId?: string;
    action: AuditAction | string;
    entityName?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
  }): Promise<AuditLog> {
    const auditLog = new AuditLog();
    auditLog.userId = data.userId || 'anonymous';
    auditLog.action = data.action;
    auditLog.entityName = data.entityName || '';
    auditLog.entityId = data.entityId || '';
    auditLog.metadata = data.metadata;

    // Encrypt sensitive payload data
    if (data.oldValue) {
      auditLog.oldValue = this.encrypt(JSON.stringify(data.oldValue));
    }
    if (data.newValue) {
      auditLog.newValue = this.encrypt(JSON.stringify(data.newValue));
    }

    // Generate tamper-proof hash for integrity (on plaintext fields)
    const logData = JSON.stringify({
      userId: auditLog.userId,
      action: auditLog.action,
      entityName: auditLog.entityName,
      entityId: auditLog.entityId,
      oldValue: auditLog.oldValue,
      newValue: auditLog.newValue,
      createdAt: new Date().toISOString(),
    });

    auditLog.hash = crypto
      .createHmac('sha256', this.auditSecret)
      .update(logData)
      .digest('hex');

    const savedLog = await this.auditLogRepository.save(auditLog);
    this.logger.log(`Audit Log Created: ${auditLog.action} (ID: ${savedLog.id})`);
    
    return savedLog;
  }

  async verifyLogIntegrity(logId: string): Promise<boolean> {
    const log = await this.auditLogRepository.findOne({ where: { id: logId } });
    if (!log) return false;

    const logData = JSON.stringify({
      userId: log.userId,
      action: log.action,
      entityName: log.entityName,
      entityId: log.entityId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt.toISOString(),
    });

    const expectedHash = crypto
      .createHmac('sha256', this.auditSecret)
      .update(logData)
      .digest('hex');

    return log.hash === expectedHash;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  async getLogs(query: {
    userId?: string;
    action?: string;
    entityName?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    decryptData?: boolean;
  }) {
    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (query.userId) qb.andWhere('log.userId = :userId', { userId: query.userId });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.entityName) qb.andWhere('log.entityName = :entityName', { entityName: query.entityName });
    if (query.startDate) qb.andWhere('log.createdAt >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('log.createdAt <= :endDate', { endDate: query.endDate });

    qb.orderBy('log.createdAt', 'DESC');
    qb.limit(query.limit || 50);
    qb.offset(query.offset || 0);

    const [logs, total] = await qb.getManyAndCount();

    if (query.decryptData) {
      logs.forEach(log => {
        if (log.oldValue) {
          try {
            log.oldValue = JSON.parse(this.decrypt(log.oldValue));
          } catch (e) {
            log.oldValue = { error: 'Decryption failed' };
          }
        }
        if (log.newValue) {
          try {
            log.newValue = JSON.parse(this.decrypt(log.newValue));
          } catch (e) {
            log.newValue = { error: 'Decryption failed' };
          }
        }
      });
    }

    return { logs, total };
  }
}
