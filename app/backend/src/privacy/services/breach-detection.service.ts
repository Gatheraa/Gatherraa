import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { DataBreach } from '../entities/data-breach.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';

export interface BreachIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  threshold: number;
  currentValue: number;
  detectedAt: Date;
}

export interface BreachAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  data: any;
  timestamp: Date;
  requiresImmediateAction: boolean;
}

export interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  severity: string;
  source: string;
  timestamp: Date;
  affectedSystems: string[];
  metadata: Record<string, any>;
}

@Injectable()
export class BreachDetectionService {
  private readonly logger = new Logger(BreachDetectionService.name);
  private readonly breachIndicators: BreachIndicator[] = [];
  private readonly activeAlerts = new Map<string, BreachAlert>();

  constructor(
    @InjectRepository(DataBreach)
    private dataBreachRepository: Repository<DataBreach>,
    private mailerService: MailerService,
  ) {
    this.initializeBreachIndicators();
  }

  /**
   * Initialize breach detection indicators
   */
  private initializeBreachIndicators(): void {
    this.breachIndicators = [
      {
        type: 'unusual_access_patterns',
        severity: 'high',
        description: 'Unusual access patterns detected',
        threshold: 100, // 100 failed login attempts
        currentValue: 0,
        detectedAt: new Date(),
      },
      {
        type: 'data_export_spike',
        severity: 'critical',
        description: 'Spike in data export requests',
        threshold: 1000, // 1000 export requests in 1 hour
        currentValue: 0,
        detectedAt: new Date(),
      },
      {
        type: 'consent_withdrawal_spike',
        severity: 'high',
        description: 'Unusual spike in consent withdrawals',
        threshold: 50, // 50 withdrawals in 1 hour
        currentValue: 0,
        detectedAt: new Date(),
      },
      {
        type: 'unauthorized_access_attempts',
        severity: 'critical',
        description: 'Multiple unauthorized access attempts',
        threshold: 10, // 10 unauthorized attempts
        currentValue: 0,
        detectedAt: new Date(),
      },
      {
        type: 'data_anomaly_detection',
        severity: 'medium',
        description: 'Anomalies detected in data processing',
        threshold: 5, // 5 anomalies detected
        currentValue: 0,
        detectedAt: new Date(),
      },
      {
        type: 'system_compromise_indicators',
        severity: 'critical',
        description: 'System compromise indicators detected',
        threshold: 1, // Any compromise indicator
        currentValue: 0,
        detectedAt: new Date(),
      },
    ];
  }

  /**
   * Monitor for breach indicators
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorBreachIndicators(): Promise<void> {
    this.logger.log('Monitoring breach indicators');

    try {
      const alerts: BreachAlert[] = [];

      for (const indicator of this.breachIndicators) {
        const currentValue = await this.getIndicatorValue(indicator.type);
        indicator.currentValue = currentValue;
        indicator.detectedAt = new Date();

        if (currentValue >= indicator.threshold) {
          const alert = this.createBreachAlert(indicator);
          alerts.push(alert);
        }
      }

      // Process detected alerts
      for (const alert of alerts) {
        await this.processBreachAlert(alert);
      }

    } catch (error) {
      this.logger.error('Error monitoring breach indicators', error);
    }
  }

  /**
   * Get current value for a breach indicator
   */
  private async getIndicatorValue(type: string): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    switch (type) {
      case 'unusual_access_patterns':
        return await this.getFailedLoginCount(oneHourAgo);
      
      case 'data_export_spike':
        return await this.getDataExportCount(oneHourAgo);
      
      case 'consent_withdrawal_spike':
        return await this.getConsentWithdrawalCount(oneHourAgo);
      
      case 'unauthorized_access_attempts':
        return await this.getUnauthorizedAccessCount(oneHourAgo);
      
      case 'data_anomaly_detection':
        return await this.getDataAnomalyCount(oneHourAgo);
      
      case 'system_compromise_indicators':
        return await this.getSystemCompromiseCount(oneHourAgo);
      
      default:
        return 0;
    }
  }

  /**
   * Get failed login count (simplified)
   */
  private async getFailedLoginCount(since: Date): Promise<number> {
    // In a real implementation, this would query authentication logs
    // For demo purposes, return a simulated value
    return Math.floor(Math.random() * 10);
  }

  /**
   * Get data export count (simplified)
   */
  private async getDataExportCount(since: Date): Promise<number> {
    // In a real implementation, this would query data export logs
    return Math.floor(Math.random() * 50);
  }

  /**
   * Get consent withdrawal count
   */
  private async getConsentWithdrawalCount(since: Date): Promise<number> {
    // This would query the consent withdrawal logs
    return Math.floor(Math.random() * 5);
  }

  /**
   * Get unauthorized access count (simplified)
   */
  private async getUnauthorizedAccessCount(since: Date): Promise<number> {
    // In a real implementation, this would query access control logs
    return Math.floor(Math.random() * 3);
  }

  /**
   * Get data anomaly count (simplified)
   */
  private async getDataAnomalyCount(since: Date): Promise<number> {
    // In a real implementation, this would use anomaly detection algorithms
    return Math.floor(Math.random() * 2);
  }

  /**
   * Get system compromise count (simplified)
   */
  private async getSystemCompromiseCount(since: Date): Promise<number> {
    // In a real implementation, this would check system integrity logs
    return Math.floor(Math.random() * 1);
  }

  /**
   * Create a breach alert
   */
  private createBreachAlert(indicator: BreachIndicator): BreachAlert {
    return {
      id: randomUUID(),
      type: indicator.type,
      severity: indicator.severity,
      message: `${indicator.description}: ${indicator.currentValue} (threshold: ${indicator.threshold})`,
      data: {
        threshold: indicator.threshold,
        currentValue: indicator.currentValue,
        detectedAt: indicator.detectedAt,
      },
      timestamp: new Date(),
      requiresImmediateAction: indicator.severity === 'critical',
    };
  }

  /**
   * Process a breach alert
   */
  private async processBreachAlert(alert: BreachAlert): Promise<void> {
    // Check if this alert is already active
    if (this.activeAlerts.has(alert.type)) {
      return; // Already processing this type of alert
    }

    this.activeAlerts.set(alert.type, alert);
    this.logger.warn(`Breach alert detected: ${alert.message}`);

    // Create a data breach record if severity is high or critical
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await this.createDataBreachRecord(alert);
    }

    // Send notifications
    await this.sendBreachNotification(alert);

    // Trigger automated response if critical
    if (alert.severity === 'critical') {
      await this.triggerAutomatedResponse(alert);
    }
  }

  /**
   * Create a data breach record
   */
  private async createDataBreachRecord(alert: BreachAlert): Promise<void> {
    const breach = this.dataBreachRepository.create({
      incidentId: `BR-${Date.now()}`,
      description: alert.message,
      severity: alert.severity,
      breachType: 'confidentiality',
      detectionDate: alert.timestamp,
      affectedData: {
        dataCategories: ['personal', 'contact'],
        recordsCount: alert.data.currentValue || 0,
        usersAffected: 0, // Would be calculated based on actual impact
        specialCategories: [],
      },
      affectedSystems: [{
        systemName: 'Authentication System',
        components: ['Login Service'],
        accessLevel: 'user',
      }],
      causes: [{
        type: 'security_incident',
        description: alert.message,
        likelihood: 'high',
      }],
      impacts: {
        financial: 'unknown',
        reputational: 'medium',
        regulatory: 'high',
        operational: 'low',
      },
      responseActions: [{
        action: 'Alert detected and logged',
        timestamp: new Date(),
        responsible: 'Automated System',
        status: 'completed',
      }],
      notifications: {
        supervisoryAuthority: {
          required: alert.severity === 'critical',
          sent: false,
          sentAt: null,
          reference: null,
        },
        dataSubjects: {
          required: false,
          sent: false,
          sentAt: null,
          method: null,
          count: 0,
        },
        stakeholders: [],
      },
      mitigationMeasures: [],
      complianceRequirements: {
        gdpr72Hours: alert.severity === 'critical',
        ccpaNotification: alert.severity === 'critical',
        documentationRequired: true,
        reportGenerated: false,
      },
      status: 'open',
      auditTrail: [{
        timestamp: new Date(),
        action: 'breach_detected',
        userId: 'system',
        details: alert.message,
        previousState: null,
        newState: 'open',
      }],
    });

    await this.dataBreachRepository.save(breach);
    this.logger.log(`Data breach record created: ${breach.incidentId}`);
  }

  /**
   * Send breach notification
   */
  private async sendBreachNotification(alert: BreachAlert): Promise<void> {
    try {
      const recipients = this.getNotificationRecipients(alert.severity);
      
      await this.mailerService.sendMail({
        to: recipients.join(','),
        subject: `[${alert.severity.toUpperCase()}] Security Breach Alert`,
        template: 'breach-alert',
        context: {
          alert,
          timestamp: new Date(),
          actionRequired: alert.requiresImmediateAction,
        },
      });

      this.logger.log(`Breach notification sent for ${alert.type}`);
    } catch (error) {
      this.logger.error('Failed to send breach notification', error);
    }
  }

  /**
   * Get notification recipients based on severity
   */
  private getNotificationRecipients(severity: string): string[] {
    const baseRecipients = ['security@gathera.io', 'dpo@gathera.io'];
    
    if (severity === 'critical') {
      return [...baseRecipients, 'cto@gathera.io', 'legal@gathera.io'];
    }
    
    if (severity === 'high') {
      return [...baseRecipients, 'security-lead@gathera.io'];
    }
    
    return baseRecipients;
  }

  /**
   * Trigger automated response for critical alerts
   */
  private async triggerAutomatedResponse(alert: BreachAlert): Promise<void> {
    this.logger.log(`Triggering automated response for ${alert.type}`);

    switch (alert.type) {
      case 'unauthorized_access_attempts':
        await this.triggerLockdownMechanism();
        break;
      
      case 'data_export_spike':
        await this.suspendDataExports();
        break;
      
      case 'system_compromise_indicators':
        await this.triggerEmergencyLockdown();
        break;
      
      default:
        this.logger.log(`No automated response defined for ${alert.type}`);
    }
  }

  /**
   * Trigger lockdown mechanism
   */
  private async triggerLockdownMechanism(): Promise<void> {
    this.logger.log('Lockdown mechanism triggered - implementing rate limiting');
    // In a real implementation, this would:
    // - Implement stricter rate limiting
    // - Enable multi-factor authentication requirements
    // - Temporarily lock suspicious accounts
  }

  /**
   * Suspend data exports
   */
  private async suspendDataExports(): Promise<void> {
    this.logger.log('Data exports suspended due to suspicious activity');
    // In a real implementation, this would:
    // - Disable data export endpoints
    // - Require additional verification for exports
    // - Log all export attempts for review
  }

  /**
   * Trigger emergency lockdown
   */
  private async triggerEmergencyLockdown(): Promise<void> {
    this.logger.log('Emergency lockdown triggered - maximum security measures activated');
    // In a real implementation, this would:
    // - Disable non-essential services
    // - Force re-authentication for all users
    // - Enable comprehensive logging
    // - Notify all system administrators
  }

  /**
   * Report a security event
   */
  async reportSecurityEvent(event: SecurityEvent): Promise<void> {
    this.logger.log(`Security event reported: ${event.type}`);

    // Check if this event matches any breach indicators
    const matchingIndicator = this.breachIndicators.find(
      indicator => indicator.type === event.type
    );

    if (matchingIndicator) {
      matchingIndicator.currentValue += 1;
      matchingIndicator.detectedAt = event.timestamp;

      if (matchingIndicator.currentValue >= matchingIndicator.threshold) {
        const alert = this.createBreachAlert(matchingIndicator);
        await this.processBreachAlert(alert);
      }
    }

    // Store the security event for audit purposes
    // In a real implementation, this would be stored in a security events table
  }

  /**
   * Get active breach alerts
   */
  getActiveAlerts(): BreachAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Clear a breach alert
   */
  clearAlert(alertType: string): void {
    this.activeAlerts.delete(alertType);
    this.logger.log(`Alert cleared: ${alertType}`);
  }

  /**
   * Get breach statistics
   */
  async getBreachStatistics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const breaches = await this.dataBreachRepository.find({
      where: { createdAt: MoreThanOrEqual(startDate) },
      order: { createdAt: 'DESC' },
    });

    const statistics = {
      totalBreaches: breaches.length,
      bySeverity: {
        low: breaches.filter(b => b.severity === 'low').length,
        medium: breaches.filter(b => b.severity === 'medium').length,
        high: breaches.filter(b => b.severity === 'high').length,
        critical: breaches.filter(b => b.severity === 'critical').length,
      },
      byStatus: {
        open: breaches.filter(b => b.status === 'open').length,
        investigating: breaches.filter(b => b.status === 'investigating').length,
        contained: breaches.filter(b => b.status === 'contained').length,
        resolved: breaches.filter(b => b.status === 'resolved').length,
        closed: breaches.filter(b => b.status === 'closed').length,
      },
      averageResolutionTime: this.calculateAverageResolutionTime(breaches),
      activeAlerts: this.activeAlerts.size,
      indicators: this.breachIndicators.map(indicator => ({
        type: indicator.type,
        severity: indicator.severity,
        threshold: indicator.threshold,
        currentValue: indicator.currentValue,
        status: indicator.currentValue >= indicator.threshold ? 'triggered' : 'normal',
      })),
    };

    return statistics;
  }

  /**
   * Calculate average resolution time
   */
  private calculateAverageResolutionTime(breaches: DataBreach[]): number {
    const resolvedBreaches = breaches.filter(b => 
      b.status === 'resolved' || b.status === 'closed'
    );

    if (resolvedBreaches.length === 0) {
      return 0;
    }

    const totalResolutionTime = resolvedBreaches.reduce((total, breach) => {
      if (breach.resolutionDate && breach.detectionDate) {
        return total + (breach.resolutionDate.getTime() - breach.detectionDate.getTime());
      }
      return total;
    }, 0);

    return Math.round(totalResolutionTime / resolvedBreaches.length / (1000 * 60 * 60)); // hours
  }

  /**
   * Generate breach detection report
   */
  async generateBreachReport(startDate: Date, endDate: Date): Promise<any> {
    const breaches = await this.dataBreachRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });

    const statistics = await this.getBreachStatistics();

    return {
      reportPeriod: {
        startDate,
        endDate,
      },
      summary: {
        totalBreaches: breaches.length,
        criticalIncidents: breaches.filter(b => b.severity === 'critical').length,
        averageResolutionTime: statistics.averageResolutionTime,
        complianceStatus: this.assessComplianceStatus(breaches),
      },
      breakdown: statistics.bySeverity,
      trends: this.analyzeTrends(breaches),
      recommendations: this.generateRecommendations(breaches),
      generatedAt: new Date(),
    };
  }

  /**
   * Assess compliance status
   */
  private assessComplianceStatus(breaches: DataBreach[]): string {
    const criticalBreaches = breaches.filter(b => b.severity === 'critical');
    const unresolvedCritical = criticalBreaches.filter(b => 
      b.status !== 'resolved' && b.status !== 'closed'
    );

    if (unresolvedCritical.length > 0) {
      return 'non_compliant';
    }

    const highBreaches = breaches.filter(b => b.severity === 'high');
    if (highBreaches.length > 5) {
      return 'attention_required';
    }

    return 'compliant';
  }

  /**
   * Analyze breach trends
   */
  private analyzeTrends(breaches: DataBreach[]): any {
    // Simple trend analysis - in a real implementation, this would be more sophisticated
    const recentBreaches = breaches.slice(-10);
    const olderBreaches = breaches.slice(0, 10);

    return {
      direction: recentBreaches.length > olderBreaches.length ? 'increasing' : 'decreasing',
      commonTypes: this.getMostCommonTypes(breaches),
      averageSeverity: this.calculateAverageSeverity(breaches),
    };
  }

  /**
   * Get most common breach types
   */
  private getMostCommonTypes(breaches: DataBreach[]): string[] {
    const typeCounts = breaches.reduce((counts, breach) => {
      counts[breach.breachType] = (counts[breach.breachType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * Calculate average severity
   */
  private calculateAverageSeverity(breaches: DataBreach[]): number {
    if (breaches.length === 0) return 0;

    const severityValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const total = breaches.reduce((sum, breach) => 
      sum + severityValues[breach.severity as keyof typeof severityValues], 0
    );

    return total / breaches.length;
  }

  /**
   * Generate breach recommendations
   */
  private generateRecommendations(breaches: DataBreach[]): string[] {
    const recommendations: string[] = [];

    if (breaches.some(b => b.severity === 'critical')) {
      recommendations.push('Review and strengthen security controls to prevent critical breaches');
    }

    if (breaches.filter(b => b.breachType === 'confidentiality').length > 3) {
      recommendations.push('Implement additional data protection measures for confidentiality');
    }

    if (breaches.filter(b => b.status === 'open').length > 2) {
      recommendations.push('Improve incident response procedures to reduce resolution time');
    }

    return recommendations;
  }
}
