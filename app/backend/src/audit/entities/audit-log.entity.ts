import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { AuditAction, AUDIT_SENSITIVE_FIELDS } from '../constants/audit.constants';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({
    type: 'varchar',
  })
  @Index()
  action: AuditAction | string;

  @Column({ nullable: true })
  @Index()
  entityName: string;

  @Column({ nullable: true })
  @Index()
  entityId: string;

  @Column({ type: 'simple-json', nullable: true })
  oldValue: any;

  @Column({ type: 'simple-json', nullable: true })
  newValue: any;

  private sanitizeData(data: any): any {
    if (!data) return null;
    const sanitized = { ...data };
    
    // List of sensitive keys to redact from logs
    for (const key of Object.keys(sanitized)) {
      if (AUDIT_SENSITIVE_FIELDS.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
    sessionId?: string;
    [key: string]: any;
  };

  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
