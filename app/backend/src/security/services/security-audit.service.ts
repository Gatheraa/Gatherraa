import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  Index,
  ManyToOne,
  JoinColumn 
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_CHALLENGE_FAILED = 'mfa_challenge_failed',
  
  // Authorization Events
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  
  // Data Events
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  DATA_DELETION = 'data_deletion',
  DATA_EXPORT = 'data_export',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  
  // KYC/AML Events
  KYC_SUBMITTED = 'kyc_submitted',
  KYC_APPROVED = 'kyc_approved',
  KYC_REJECTED = 'kyc_rejected',
  AML_ALERT_TRIGGERED = 'aml_alert_triggered',
  AML_ALERT_RESOLVED = 'aml_alert_resolved',
  
  // System Events
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  SECURITY_POLICY_CHANGE = 'security_policy_change',
  KEY_ROTATION = 'key_rotation',
  BACKUP_COMPLETED = 'backup_completed',
  
  // Financial Events
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_APPROVED = 'transaction_approved',
  TRANSACTION_REJECTED = 'transaction_rejected',
  PAYMENT_PROCESSED = 'payment_processed',
  REFUND_ISSUED = 'refund_issued',
  
  // Compliance Events
  COMPLIANCE_REPORT_GENERATED = 'compliance_report_generated',
  REGULATORY_FILING = 'regulatory_filing',
  AUDIT_CONDUCTED = 'audit_conducted',
  INCIDENT_REPORTED = 'incident_reported',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
}

@Entity('security_audit_logs')
export class SecurityAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: AuditEventType,
  })
  @Index()
  eventType: AuditEventType;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.LOW,
  })
  @Index()
  severity: AuditSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  details: {
    resource?: string;
    resourceId?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    additionalData?: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    sessionId?: string;
    requestId?: string;
    geolocation?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
    riskScore?: number;
    threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  };

  @Column({ type: 'varchar', nullable: true })
  sourceIp: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  requestId: string;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.ACTIVE,
  })
  @Index()
  status: AuditStatus;

  @Column({ type: 'jsonb', nullable: true })
  investigation: {
    assignedTo?: string;
    assignedAt?: Date;
    notes?: string;
    actions?: Array<{
      action: string;
      performedBy: string;
      performedAt: Date;
      details?: string;
    }>;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  };

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}

export interface AuditEvent {
  userId?: string;
  action: AuditEventType;
  resource?: string;
  resourceId?: string;
  details?: any;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  geolocation?: any;
  riskScore?: number;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditQuery {
  userId?: string;
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  status?: AuditStatus;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    @InjectRepository(SecurityAuditLog)
    private readonly auditLogRepository: Repository<SecurityAuditLog>,
    private readonly configService: ConfigService,
  ) {}

  async logEvent(event: AuditEvent): Promise<SecurityAuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        userId: event.userId,
        eventType: event.action,
        description: this.generateDescription(event.action, event.details),
        severity: event.severity || this.getDefaultSeverity(event.action),
        details: {
          resource: event.resource,
          resourceId: event.resourceId,
          ...event.details,
        },
        metadata: {
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          sessionId: event.sessionId,
          requestId: event.requestId,
          geolocation: event.geolocation,
          riskScore: event.riskScore,
          threatLevel: event.threatLevel,
        },
        sourceIp: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        requestId: event.requestId,
        expiresAt: this.calculateExpiryDate(event.action),
      });

      const savedLog = await this.auditLogRepository.save(auditLog);

      // Check for immediate security alerts
      await this.checkForSecurityAlerts(savedLog);

      return savedLog;
    } catch (error) {
      this.logger.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main flow
      return null;
    }
  }

  async queryAuditLogs(query: AuditQuery): Promise<{
    logs: SecurityAuditLog[];
    total: number;
  }> {
    const where: any = {};

    if (query.userId) where.userId = query.userId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.ipAddress) where.sourceIp = query.ipAddress;
    if (query.resourceId) {
      // Search in JSON details
      where.details = { resourceId: query.resourceId };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = Between(
        query.startDate || new Date(0),
        query.endDate || new Date()
      );
    }

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      relations: ['user'],
      take: query.limit || 100,
      skip: query.offset || 0,
    });

    return { logs, total };
  }

  async getAuditLogById(id: string): Promise<SecurityAuditLog> {
    return this.auditLogRepository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async getSecurityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topIpAddresses: Array<{ ipAddress: string; eventCount: number }>;
    criticalEvents: SecurityAuditLog[];
  }> {
    const logs = await this.auditLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });

    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<AuditSeverity, number>;
    const userEventCounts = new Map<string, number>();
    const ipEventCounts = new Map<string, number>();

    for (const log of logs) {
      // Count by type
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[log.severity] = (eventsBySeverity[log.severity] || 0) + 1;
      
      // Count by user
      if (log.userId) {
        userEventCounts.set(log.userId, (userEventCounts.get(log.userId) || 0) + 1);
      }
      
      // Count by IP
      if (log.sourceIp) {
        ipEventCounts.set(log.sourceIp, (ipEventCounts.get(log.sourceIp) || 0) + 1);
      }
    }

    const topUsers = Array.from(userEventCounts.entries())
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    const topIpAddresses = Array.from(ipEventCounts.entries())
      .map(([ipAddress, eventCount]) => ({ ipAddress, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    const criticalEvents = logs.filter(log => log.severity === AuditSeverity.CRITICAL);

    return {
      totalEvents: logs.length,
      eventsByType,
      eventsBySeverity,
      topUsers,
      topIpAddresses,
      criticalEvents,
    };
  }

  async investigateAuditLog(
    logId: string,
    investigatorId: string,
    notes?: string
  ): Promise<SecurityAuditLog> {
    const log = await this.auditLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new Error('Audit log not found');
    }

    log.status = AuditStatus.INVESTIGATING;
    log.investigation = {
      assignedTo: investigatorId,
      assignedAt: new Date(),
      notes,
    };

    return this.auditLogRepository.save(log);
  }

  async resolveAuditLog(
    logId: string,
    resolverId: string,
    resolution: string,
    notes?: string
  ): Promise<SecurityAuditLog> {
    const log = await this.auditLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new Error('Audit log not found');
    }

    log.status = AuditStatus.RESOLVED;
    log.reviewedAt = new Date();
    log.reviewedBy = resolverId;
    log.investigation = {
      ...log.investigation,
      resolution,
      resolvedBy: resolverId,
      resolvedAt: new Date(),
      notes: notes ? (log.investigation?.notes ? `${log.investigation.notes}\n\n${notes}` : notes) : log.investigation?.notes,
    };

    return this.auditLogRepository.save(log);
  }

  async archiveOldLogs(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogRepository.update(
      {
        createdAt: LessThan(cutoffDate),
        status: AuditStatus.ACTIVE,
      },
      {
        status: AuditStatus.ARCHIVED,
      }
    );

    this.logger.log(`Archived ${result.affected} audit logs older than ${daysToKeep} days`);
    return result.affected;
  }

  async deleteExpiredLogs(): Promise<number> {
    const result = await this.auditLogRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Deleted ${result.affected} expired audit logs`);
    return result.affected;
  }

  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    reportType: 'SOX' | 'GDPR' | 'PCI' | 'AML' = 'AML'
  ): Promise<{
    reportId: string;
    generatedAt: Date;
    period: { start: Date; end: Date };
    summary: any;
    details: any;
    recommendations: string[];
  }> {
    const metrics = await this.getSecurityMetrics(startDate, endDate);
    
    const report = {
      reportId: `audit_${reportType}_${Date.now()}`,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: metrics.totalEvents,
        criticalEvents: metrics.criticalEvents.length,
        complianceScore: this.calculateComplianceScore(metrics, reportType),
      },
      details: metrics,
      recommendations: this.generateComplianceRecommendations(metrics, reportType),
    };

    // Log the report generation
    await this.logEvent({
      action: AuditEventType.COMPLIANCE_REPORT_GENERATED,
      details: {
        reportType,
        reportId: report.reportId,
        period: report.period,
        complianceScore: report.summary.complianceScore,
      },
      severity: AuditSeverity.LOW,
    });

    return report;
  }

  private generateDescription(action: AuditEventType, details?: any): string {
    const descriptions: Record<AuditEventType, string> = {
      [AuditEventType.LOGIN_SUCCESS]: 'User successfully logged in',
      [AuditEventType.LOGIN_FAILED]: 'User login attempt failed',
      [AuditEventType.LOGOUT]: 'User logged out',
      [AuditEventType.PASSWORD_CHANGE]: 'User password was changed',
      [AuditEventType.MFA_ENABLED]: 'Multi-factor authentication was enabled',
      [AuditEventType.MFA_DISABLED]: 'Multi-factor authentication was disabled',
      [AuditEventType.MFA_CHALLENGE_FAILED]: 'MFA challenge failed',
      [AuditEventType.ROLE_ASSIGNED]: 'Role was assigned to user',
      [AuditEventType.ROLE_REMOVED]: 'Role was removed from user',
      [AuditEventType.PERMISSION_GRANTED]: 'Permission was granted',
      [AuditEventType.PERMISSION_REVOKED]: 'Permission was revoked',
      [AuditEventType.ACCESS_DENIED]: 'Access was denied',
      [AuditEventType.PRIVILEGE_ESCALATION]: 'Privilege escalation detected',
      [AuditEventType.DATA_ACCESS]: 'Data was accessed',
      [AuditEventType.DATA_MODIFICATION]: 'Data was modified',
      [AuditEventType.DATA_DELETION]: 'Data was deleted',
      [AuditEventType.DATA_EXPORT]: 'Data was exported',
      [AuditEventType.SENSITIVE_DATA_ACCESS]: 'Sensitive data was accessed',
      [AuditEventType.KYC_SUBMITTED]: 'KYC verification was submitted',
      [AuditEventType.KYC_APPROVED]: 'KYC verification was approved',
      [AuditEventType.KYC_REJECTED]: 'KYC verification was rejected',
      [AuditEventType.AML_ALERT_TRIGGERED]: 'AML alert was triggered',
      [AuditEventType.AML_ALERT_RESOLVED]: 'AML alert was resolved',
      [AuditEventType.SYSTEM_CONFIG_CHANGE]: 'System configuration was changed',
      [AuditEventType.SECURITY_POLICY_CHANGE]: 'Security policy was changed',
      [AuditEventType.KEY_ROTATION]: 'Encryption key rotation was performed',
      [AuditEventType.BACKUP_COMPLETED]: 'Backup was completed',
      [AuditEventType.TRANSACTION_CREATED]: 'Transaction was created',
      [AuditEventType.TRANSACTION_APPROVED]: 'Transaction was approved',
      [AuditEventType.TRANSACTION_REJECTED]: 'Transaction was rejected',
      [AuditEventType.PAYMENT_PROCESSED]: 'Payment was processed',
      [AuditEventType.REFUND_ISSUED]: 'Refund was issued',
      [AuditEventType.COMPLIANCE_REPORT_GENERATED]: 'Compliance report was generated',
      [AuditEventType.REGULATORY_FILING]: 'Regulatory filing was made',
      [AuditEventType.AUDIT_CONDUCTED]: 'Audit was conducted',
      [AuditEventType.INCIDENT_REPORTED]: 'Security incident was reported',
    };

    return descriptions[action] || 'Unknown security event';
  }

  private getDefaultSeverity(action: AuditEventType): AuditSeverity {
    const severityMap: Record<AuditEventType, AuditSeverity> = {
      [AuditEventType.LOGIN_SUCCESS]: AuditSeverity.LOW,
      [AuditEventType.LOGIN_FAILED]: AuditSeverity.MEDIUM,
      [AuditEventType.LOGOUT]: AuditSeverity.LOW,
      [AuditEventType.PASSWORD_CHANGE]: AuditSeverity.MEDIUM,
      [AuditEventType.MFA_ENABLED]: AuditSeverity.LOW,
      [AuditEventType.MFA_DISABLED]: AuditSeverity.HIGH,
      [AuditEventType.MFA_CHALLENGE_FAILED]: AuditSeverity.MEDIUM,
      [AuditEventType.ROLE_ASSIGNED]: AuditSeverity.MEDIUM,
      [AuditEventType.ROLE_REMOVED]: AuditSeverity.MEDIUM,
      [AuditEventType.PERMISSION_GRANTED]: AuditSeverity.MEDIUM,
      [AuditEventType.PERMISSION_REVOKED]: AuditSeverity.MEDIUM,
      [AuditEventType.ACCESS_DENIED]: AuditSeverity.HIGH,
      [AuditEventType.PRIVILEGE_ESCALATION]: AuditSeverity.CRITICAL,
      [AuditEventType.DATA_ACCESS]: AuditSeverity.MEDIUM,
      [AuditEventType.DATA_MODIFICATION]: AuditSeverity.HIGH,
      [AuditEventType.DATA_DELETION]: AuditSeverity.HIGH,
      [AuditEventType.DATA_EXPORT]: AuditSeverity.HIGH,
      [AuditEventType.SENSITIVE_DATA_ACCESS]: AuditSeverity.HIGH,
      [AuditEventType.KYC_SUBMITTED]: AuditSeverity.MEDIUM,
      [AuditEventType.KYC_APPROVED]: AuditSeverity.MEDIUM,
      [AuditEventType.KYC_REJECTED]: AuditSeverity.HIGH,
      [AuditEventType.AML_ALERT_TRIGGERED]: AuditSeverity.CRITICAL,
      [AuditEventType.AML_ALERT_RESOLVED]: AuditSeverity.MEDIUM,
      [AuditEventType.SYSTEM_CONFIG_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.SECURITY_POLICY_CHANGE]: AuditSeverity.HIGH,
      [AuditEventType.KEY_ROTATION]: AuditSeverity.MEDIUM,
      [AuditEventType.BACKUP_COMPLETED]: AuditSeverity.LOW,
      [AuditEventType.TRANSACTION_CREATED]: AuditSeverity.MEDIUM,
      [AuditEventType.TRANSACTION_APPROVED]: AuditSeverity.MEDIUM,
      [AuditEventType.TRANSACTION_REJECTED]: AuditSeverity.HIGH,
      [AuditEventType.PAYMENT_PROCESSED]: AuditSeverity.MEDIUM,
      [AuditEventType.REFUND_ISSUED]: AuditSeverity.MEDIUM,
      [AuditEventType.COMPLIANCE_REPORT_GENERATED]: AuditSeverity.LOW,
      [AuditEventType.REGULATORY_FILING]: AuditSeverity.HIGH,
      [AuditEventType.AUDIT_CONDUCTED]: AuditSeverity.MEDIUM,
      [AuditEventType.INCIDENT_REPORTED]: AuditSeverity.CRITICAL,
    };

    return severityMap[action] || AuditSeverity.LOW;
  }

  private calculateExpiryDate(action: AuditEventType): Date {
    const retentionPeriods: Record<AuditEventType, number> = {
      [AuditEventType.LOGIN_SUCCESS]: 90, // days
      [AuditEventType.LOGIN_FAILED]: 365,
      [AuditEventType.LOGOUT]: 30,
      [AuditEventType.PASSWORD_CHANGE]: 365,
      [AuditEventType.MFA_ENABLED]: 365,
      [AuditEventType.MFA_DISABLED]: 365,
      [AuditEventType.MFA_CHALLENGE_FAILED]: 365,
      [AuditEventType.ROLE_ASSIGNED]: 1825, // 5 years
      [AuditEventType.ROLE_REMOVED]: 1825,
      [AuditEventType.PERMISSION_GRANTED]: 1825,
      [AuditEventType.PERMISSION_REVOKED]: 1825,
      [AuditEventType.ACCESS_DENIED]: 365,
      [AuditEventType.PRIVILEGE_ESCALATION]: 2555, // 7 years
      [AuditEventType.DATA_ACCESS]: 365,
      [AuditEventType.DATA_MODIFICATION]: 1825,
      [AuditEventType.DATA_DELETION]: 2555,
      [AuditEventType.DATA_EXPORT]: 1825,
      [AuditEventType.SENSITIVE_DATA_ACCESS]: 1825,
      [AuditEventType.KYC_SUBMITTED]: 2555,
      [AuditEventType.KYC_APPROVED]: 2555,
      [AuditEventType.KYC_REJECTED]: 2555,
      [AuditEventType.AML_ALERT_TRIGGERED]: 2555,
      [AuditEventType.AML_ALERT_RESOLVED]: 2555,
      [AuditEventType.SYSTEM_CONFIG_CHANGE]: 1825,
      [AuditEventType.SECURITY_POLICY_CHANGE]: 1825,
      [AuditEventType.KEY_ROTATION]: 365,
      [AuditEventType.BACKUP_COMPLETED]: 90,
      [AuditEventType.TRANSACTION_CREATED]: 2555,
      [AuditEventType.TRANSACTION_APPROVED]: 2555,
      [AuditEventType.TRANSACTION_REJECTED]: 2555,
      [AuditEventType.PAYMENT_PROCESSED]: 2555,
      [AuditEventType.REFUND_ISSUED]: 1825,
      [AuditEventType.COMPLIANCE_REPORT_GENERATED]: 1825,
      [AuditEventType.REGULATORY_FILING]: 2555,
      [AuditEventType.AUDIT_CONDUCTED]: 1825,
      [AuditEventType.INCIDENT_REPORTED]: 2555,
    };

    const days = retentionPeriods[action] || 365;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    return expiryDate;
  }

  private async checkForSecurityAlerts(log: SecurityAuditLog): Promise<void> {
    // Check for critical events that need immediate attention
    if (log.severity === AuditSeverity.CRITICAL) {
      // In production, send alerts to security team
      this.logger.warn(`CRITICAL SECURITY EVENT: ${log.eventType}`, {
        logId: log.id,
        userId: log.userId,
        details: log.details,
      });
    }

    // Check for patterns that might indicate attacks
    await this.checkForAttackPatterns(log);
  }

  private async checkForAttackPatterns(log: SecurityAuditLog): Promise<void> {
    // Check for multiple failed logins from same IP
    if (log.eventType === AuditEventType.LOGIN_FAILED) {
      const recentFailures = await this.auditLogRepository.count({
        where: {
          eventType: AuditEventType.LOGIN_FAILED,
          sourceIp: log.sourceIp,
          createdAt: Between(
            new Date(Date.now() - 15 * 60 * 1000), // last 15 minutes
            new Date()
          ),
        },
      });

      if (recentFailures >= 5) {
        this.logger.warn(`Potential brute force attack from IP: ${log.sourceIp}`);
        // In production, trigger IP blocking or rate limiting
      }
    }
  }

  private calculateComplianceScore(metrics: any, reportType: string): number {
    // Simplified compliance score calculation
    let score = 100;

    // Deduct points for critical events
    score -= metrics.criticalEvents.length * 10;

    // Deduct points for high-severity events
    const highSeverityCount = Object.entries(metrics.eventsBySeverity)
      .filter(([severity]) => severity === AuditSeverity.HIGH)
      .reduce((sum, [, count]) => sum + count, 0);
    score -= highSeverityCount * 5;

    return Math.max(0, Math.min(100, score));
  }

  private generateComplianceRecommendations(metrics: any, reportType: string): string[] {
    const recommendations: string[] = [];

    if (metrics.criticalEvents.length > 0) {
      recommendations.push('Review and investigate all critical security events immediately');
    }

    const highSeverityCount = metrics.eventsBySeverity[AuditSeverity.HIGH] || 0;
    if (highSeverityCount > 10) {
      recommendations.push('Implement additional security controls to reduce high-severity events');
    }

    const failedLogins = metrics.eventsByType[AuditEventType.LOGIN_FAILED] || 0;
    if (failedLogins > 100) {
      recommendations.push('Review authentication mechanisms and consider implementing stronger controls');
    }

    return recommendations;
  }
}
