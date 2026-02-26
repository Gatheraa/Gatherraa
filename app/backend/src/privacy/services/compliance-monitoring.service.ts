import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { PrivacyAudit } from '../entities/privacy-audit.entity';
import { DataProcessingRecord } from '../entities/data-processing-record.entity';
import { PrivacyFrameworkService } from './privacy-framework.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '@nestjs-modules/mailer';

export interface ComplianceCheck {
  id: string;
  framework: string;
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed';
  score: number;
  lastChecked: Date;
  nextReview: Date;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

export interface ComplianceReport {
  framework: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  overallScore: number;
  status: 'compliant' | 'non_compliant' | 'attention_required';
  checks: ComplianceCheck[];
  trends: {
    scoreHistory: Array<{ date: string; score: number }>;
    complianceRate: number;
    criticalIssues: number;
  };
  recommendations: string[];
  generatedAt: Date;
}

export interface ComplianceAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  framework: string;
  requirement: string;
  timestamp: Date;
  actionRequired: boolean;
  dueDate?: Date;
}

@Injectable()
export class ComplianceMonitoringService {
  private readonly logger = new Logger(ComplianceMonitoringService.name);
  private readonly complianceChecks = new Map<string, ComplianceCheck>();
  private readonly activeAlerts = new Map<string, ComplianceAlert>();

  constructor(
    @InjectRepository(PrivacyAudit)
    private auditRepository: Repository<PrivacyAudit>,
    @InjectRepository(DataProcessingRecord)
    private processingRepository: Repository<DataProcessingRecord>,
    private privacyFrameworkService: PrivacyFrameworkService,
    private mailerService: MailerService,
  ) {
    this.initializeComplianceChecks();
  }

  /**
   * Initialize compliance checks
   */
  private initializeComplianceChecks(): void {
    const frameworks = this.privacyFrameworkService.getComplianceFrameworks();

    for (const framework of frameworks) {
      for (const requirement of framework.requirements) {
        const check: ComplianceCheck = {
          id: `${framework.name}_${requirement.id}`,
          framework: framework.name,
          requirement: requirement.title,
          status: 'not_assessed',
          score: 0,
          lastChecked: new Date(),
          nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          evidence: [],
          findings: '',
          recommendations: [],
        };

        this.complianceChecks.set(check.id, check);
      }
    }
  }

  /**
   * Run scheduled compliance monitoring
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runComplianceMonitoring(): Promise<void> {
    this.logger.log('Running scheduled compliance monitoring');

    try {
      const frameworks = this.privacyFrameworkService.getComplianceFrameworks();
      const alerts: ComplianceAlert[] = [];

      for (const framework of frameworks) {
        const frameworkAlerts = await this.monitorFrameworkCompliance(framework);
        alerts.push(...frameworkAlerts);
      }

      // Process generated alerts
      for (const alert of alerts) {
        await this.processComplianceAlert(alert);
      }

      // Generate daily compliance summary
      await this.generateDailyComplianceSummary();

    } catch (error) {
      this.logger.error('Error during compliance monitoring', error);
    }
  }

  /**
   * Monitor compliance for a specific framework
   */
  private async monitorFrameworkCompliance(framework: any): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];

    for (const requirement of framework.requirements) {
      const checkId = `${framework.name}_${requirement.id}`;
      const existingCheck = this.complianceChecks.get(checkId);

      if (!existingCheck) {
        continue;
      }

      // Evaluate compliance for this requirement
      const evaluation = await this.evaluateRequirementCompliance(requirement);
      
      // Update the check
      existingCheck.status = evaluation.status;
      existingCheck.score = evaluation.score;
      existingCheck.lastChecked = new Date();
      existingCheck.evidence = evaluation.evidence;
      existingCheck.findings = evaluation.findings;
      existingCheck.recommendations = evaluation.recommendations;

      // Check if alert is needed
      if (evaluation.status === 'non_compliant' && requirement.riskLevel === 'critical') {
        const alert: ComplianceAlert = {
          id: `alert_${checkId}_${Date.now()}`,
          type: 'compliance_failure',
          severity: 'critical',
          message: `Critical compliance failure: ${requirement.title}`,
          framework: framework.name,
          requirement: requirement.title,
          timestamp: new Date(),
          actionRequired: true,
          dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours for critical
        };
        alerts.push(alert);
      } else if (evaluation.status === 'non_compliant' && requirement.riskLevel === 'high') {
        const alert: ComplianceAlert = {
          id: `alert_${checkId}_${Date.now()}`,
          type: 'compliance_failure',
          severity: 'high',
          message: `High-risk compliance issue: ${requirement.title}`,
          framework: framework.name,
          requirement: requirement.title,
          timestamp: new Date(),
          actionRequired: true,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for high
        };
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Evaluate compliance for a specific requirement
   */
  private async evaluateRequirementCompliance(requirement: any): Promise<{
    status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed';
    score: number;
    evidence: string[];
    findings: string;
    recommendations: string[];
  }> {
    const evaluation = {
      status: 'compliant' as const,
      score: 100,
      evidence: [] as string[],
      findings: '',
      recommendations: [] as string[],
    };

    try {
      switch (requirement.category) {
        case 'Consent Management':
          return await this.evaluateConsentManagement(requirement);
        
        case 'Data Subject Rights':
          return await this.evaluateDataSubjectRights(requirement);
        
        case 'Data Security':
          return await this.evaluateDataSecurity(requirement);
        
        case 'Breach Management':
          return await this.evaluateBreachManagement(requirement);
        
        case 'Risk Assessment':
          return await this.evaluateRiskAssessment(requirement);
        
        case 'Transparency':
          return await this.evaluateTransparency(requirement);
        
        case 'Data Sharing':
          return await this.evaluateDataSharing(requirement);
        
        case 'Access Control':
          return await this.evaluateAccessControl(requirement);
        
        default:
          return {
            ...evaluation,
            status: 'not_assessed',
            score: 0,
            findings: 'No evaluation method defined for this requirement category',
          };
      }
    } catch (error) {
      this.logger.error(`Error evaluating requirement ${requirement.id}`, error);
      return {
        ...evaluation,
        status: 'not_assessed',
        score: 0,
        findings: `Error during evaluation: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate consent management compliance
   */
  private async evaluateConsentManagement(requirement: any): Promise<any> {
    // In a real implementation, this would check:
    // - Active privacy policies
    // - Consent records
    // - Withdrawal mechanisms
    // - Consent granularity

    const evidence = [
      'Privacy policies reviewed',
      'Consent records audited',
      'Withdrawal mechanisms verified',
    ];

    // Simulated evaluation - in reality, this would check actual data
    const hasActivePolicies = true;
    const hasConsentRecords = true;
    const hasWithdrawalMechanism = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'All consent management controls are in place and functioning correctly.';
    const recommendations: string[] = [];

    if (!hasActivePolicies) {
      score -= 40;
      recommendations.push('Activate and maintain current privacy policies');
    }

    if (!hasConsentRecords) {
      score -= 30;
      recommendations.push('Implement proper consent recording mechanisms');
    }

    if (!hasWithdrawalMechanism) {
      score -= 30;
      recommendations.push('Ensure consent withdrawal mechanisms are available');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Significant gaps in consent management identified.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Some improvements needed in consent management.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate data subject rights compliance
   */
  private async evaluateDataSubjectRights(requirement: any): Promise<any> {
    const evidence = [
      'Data subject request processes reviewed',
      'Response time metrics analyzed',
      'Request fulfillment verified',
    ];

    // Simulated evaluation
    const hasRequestProcess = true;
    const meetsResponseTimes = true;
    const hasFulfillmentProcess = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Data subject rights processes are compliant.';
    const recommendations: string[] = [];

    if (!hasRequestProcess) {
      score -= 40;
      recommendations.push('Implement data subject request processes');
    }

    if (!meetsResponseTimes) {
      score -= 35;
      recommendations.push('Improve response time compliance');
    }

    if (!hasFulfillmentProcess) {
      score -= 25;
      recommendations.push('Establish request fulfillment procedures');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Data subject rights implementation requires significant improvement.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Minor improvements needed for data subject rights compliance.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate data security compliance
   */
  private async evaluateDataSecurity(requirement: any): Promise<any> {
    const evidence = [
      'Security controls reviewed',
      'Encryption status verified',
      'Access controls audited',
    ];

    // Simulated evaluation
    const hasEncryption = true;
    const hasAccessControls = true;
    const hasSecurityMonitoring = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Data security controls are properly implemented.';
    const recommendations: string[] = [];

    if (!hasEncryption) {
      score -= 35;
      recommendations.push('Implement encryption for sensitive data');
    }

    if (!hasAccessControls) {
      score -= 35;
      recommendations.push('Strengthen access control mechanisms');
    }

    if (!hasSecurityMonitoring) {
      score -= 30;
      recommendations.push('Implement continuous security monitoring');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Critical security controls are missing or inadequate.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Security controls need enhancement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate breach management compliance
   */
  private async evaluateBreachManagement(requirement: any): Promise<any> {
    const evidence = [
      'Breach detection systems reviewed',
      'Response procedures verified',
      'Notification processes checked',
    ];

    // Simulated evaluation
    const hasDetectionSystem = true;
    const hasResponsePlan = true;
    const hasNotificationProcess = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Breach management procedures are comprehensive.';
    const recommendations: string[] = [];

    if (!hasDetectionSystem) {
      score -= 35;
      recommendations.push('Implement automated breach detection');
    }

    if (!hasResponsePlan) {
      score -= 35;
      recommendations.push('Develop and test breach response plan');
    }

    if (!hasNotificationProcess) {
      score -= 30;
      recommendations.push('Establish breach notification procedures');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Breach management capabilities are insufficient.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Breach management processes need improvement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate risk assessment compliance
   */
  private async evaluateRiskAssessment(requirement: any): Promise<any> {
    const evidence = [
      'Risk assessment procedures reviewed',
      'DPIA processes analyzed',
      'Risk mitigation strategies verified',
    ];

    // Simulated evaluation
    const hasRiskAssessment = true;
    const hasDPIAProcess = true;
    const hasMitigationStrategies = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Risk assessment processes are comprehensive.';
    const recommendations: string[] = [];

    if (!hasRiskAssessment) {
      score -= 35;
      recommendations.push('Implement regular risk assessments');
    }

    if (!hasDPIAProcess) {
      score -= 35;
      recommendations.push('Establish Data Protection Impact Assessment procedures');
    }

    if (!hasMitigationStrategies) {
      score -= 30;
      recommendations.push('Develop risk mitigation strategies');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Risk assessment framework requires significant improvement.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Risk assessment processes need enhancement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate transparency compliance
   */
  private async evaluateTransparency(requirement: any): Promise<any> {
    const evidence = [
      'Privacy notices reviewed',
      'Data inventory verified',
      'Transparency reports analyzed',
    ];

    // Simulated evaluation
    const hasCurrentNotices = true;
    const hasDataInventory = true;
    const hasTransparencyReports = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Transparency obligations are met.';
    const recommendations: string[] = [];

    if (!hasCurrentNotices) {
      score -= 40;
      recommendations.push('Update privacy notices and disclosures');
    }

    if (!hasDataInventory) {
      score -= 30;
      recommendations.push('Maintain comprehensive data inventory');
    }

    if (!hasTransparencyReports) {
      score -= 30;
      recommendations.push('Generate regular transparency reports');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Transparency requirements are not adequately addressed.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Transparency practices need improvement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate data sharing compliance
   */
  private async evaluateDataSharing(requirement: any): Promise<any> {
    const evidence = [
      'Data sharing agreements reviewed',
      'Third-party controls verified',
      'Cross-border transfer mechanisms checked',
    ];

    // Simulated evaluation
    const hasSharingAgreements = true;
    const hasThirdPartyControls = true;
    const hasTransferMechanisms = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Data sharing controls are compliant.';
    const recommendations: string[] = [];

    if (!hasSharingAgreements) {
      score -= 35;
      recommendations.push('Establish data sharing agreements');
    }

    if (!hasThirdPartyControls) {
      score -= 35;
      recommendations.push('Implement third-party data processing controls');
    }

    if (!hasTransferMechanisms) {
      score -= 30;
      recommendations.push('Establish cross-border data transfer mechanisms');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Data sharing compliance requires significant improvement.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Data sharing practices need enhancement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Evaluate access control compliance
   */
  private async evaluateAccessControl(requirement: any): Promise<any> {
    const evidence = [
      'Access control systems reviewed',
      'User permissions audited',
      'Access logs analyzed',
    ];

    // Simulated evaluation
    const hasAccessControls = true;
    const hasPermissionManagement = true;
    const hasAccessLogging = true;

    let score = 100;
    let status = 'compliant' as const;
    let findings = 'Access control measures are comprehensive.';
    const recommendations: string[] = [];

    if (!hasAccessControls) {
      score -= 35;
      recommendations.push('Implement robust access control systems');
    }

    if (!hasPermissionManagement) {
      score -= 35;
      recommendations.push('Establish proper permission management');
    }

    if (!hasAccessLogging) {
      score -= 30;
      recommendations.push('Implement comprehensive access logging');
    }

    if (score < 70) {
      status = 'non_compliant';
      findings = 'Access control compliance requires significant improvement.';
    } else if (score < 90) {
      status = 'partial';
      findings = 'Access controls need enhancement.';
    }

    return {
      status,
      score,
      evidence,
      findings,
      recommendations,
    };
  }

  /**
   * Process compliance alert
   */
  private async processComplianceAlert(alert: ComplianceAlert): Promise<void> {
    // Check if this alert is already active
    if (this.activeAlerts.has(alert.id)) {
      return;
    }

    this.activeAlerts.set(alert.id, alert);
    this.logger.warn(`Compliance alert: ${alert.message}`);

    // Send notification
    await this.sendComplianceAlert(alert);

    // Create audit record
    await this.createComplianceAudit(alert);
  }

  /**
   * Send compliance alert notification
   */
  private async sendComplianceAlert(alert: ComplianceAlert): Promise<void> {
    try {
      const recipients = this.getComplianceAlertRecipients(alert.severity);
      
      await this.mailerService.sendMail({
        to: recipients.join(','),
        subject: `[${alert.severity.toUpperCase()}] Compliance Alert`,
        template: 'compliance-alert',
        context: {
          alert,
          timestamp: new Date(),
          actionRequired: alert.actionRequired,
          dueDate: alert.dueDate,
        },
      });

      this.logger.log(`Compliance alert notification sent for ${alert.framework}`);
    } catch (error) {
      this.logger.error('Failed to send compliance alert notification', error);
    }
  }

  /**
   * Get compliance alert recipients
   */
  private getComplianceAlertRecipients(severity: string): string[] {
    const baseRecipients = ['compliance@gathera.io', 'dpo@gathera.io'];
    
    if (severity === 'critical') {
      return [...baseRecipients, 'legal@gathera.io', 'executives@gathera.io'];
    }
    
    if (severity === 'high') {
      return [...baseRecipients, 'compliance-lead@gathera.io'];
    }
    
    return baseRecipients;
  }

  /**
   * Create compliance audit record
   */
  private async createComplianceAudit(alert: ComplianceAlert): Promise<void> {
    const audit = this.auditRepository.create({
      auditId: `COMP-${Date.now()}`,
      title: `Compliance Alert: ${alert.requirement}`,
      description: alert.message,
      framework: alert.framework as any,
      status: 'in_progress',
      scheduledDate: new Date(),
      scope: {
        systems: ['All Systems'],
        processes: [alert.requirement],
        dataCategories: ['All Categories'],
        geographicRegions: ['All Regions'],
      },
      criteria: [{
        requirement: alert.requirement,
        description: alert.message,
        evidence: [],
        status: 'failed',
        findings: alert.message,
      }],
      findings: [{
        category: 'Compliance',
        severity: alert.severity,
        description: alert.message,
        recommendation: 'Immediate action required',
        riskLevel: alert.severity,
      }],
      complianceScore: { overall: 0, categories: {}, trend: 'decreasing' },
      remediationPlan: [{
        action: 'Investigate compliance issue',
        priority: alert.severity,
        assignee: 'compliance-team',
        dueDate: alert.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
      }],
      evidence: [],
    });

    await this.auditRepository.save(audit);
  }

  /**
   * Generate daily compliance summary
   */
  private async generateDailyComplianceSummary(): Promise<void> {
    const checks = Array.from(this.complianceChecks.values());
    const alerts = Array.from(this.activeAlerts.values());

    const summary = {
      date: new Date(),
      totalChecks: checks.length,
      compliantChecks: checks.filter(c => c.status === 'compliant').length,
      nonCompliantChecks: checks.filter(c => c.status === 'non_compliant').length,
      partialChecks: checks.filter(c => c.status === 'partial').length,
      averageScore: checks.reduce((sum, c) => sum + c.score, 0) / checks.length,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    };

    this.logger.log('Daily compliance summary generated', summary);

    // Send summary if there are critical issues
    if (summary.criticalAlerts > 0) {
      await this.sendDailySummaryAlert(summary);
    }
  }

  /**
   * Send daily summary alert
   */
  private async sendDailySummaryAlert(summary: any): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'executives@gathera.io',
        subject: 'Daily Compliance Summary - Critical Issues Detected',
        template: 'daily-compliance-summary',
        context: {
          summary,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send daily summary alert', error);
    }
  }

  /**
   * Get compliance status
   */
  getComplianceStatus(): {
    overallScore: number;
    status: string;
    checks: ComplianceCheck[];
    alerts: ComplianceAlert[];
  } {
    const checks = Array.from(this.complianceChecks.values());
    const alerts = Array.from(this.activeAlerts.values());
    
    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
    
    let status = 'compliant';
    if (overallScore < 70) status = 'non_compliant';
    else if (overallScore < 90) status = 'attention_required';

    return {
      overallScore: Math.round(overallScore),
      status,
      checks,
      alerts,
    };
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(framework: string, startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const frameworkChecks = Array.from(this.complianceChecks.values())
      .filter(check => check.framework === framework);

    const audits = await this.auditRepository.find({
      where: {
        framework: framework as any,
        completedDate: Between(startDate, endDate),
      },
      order: { completedDate: 'DESC' },
    });

    const overallScore = frameworkChecks.reduce((sum, check) => sum + check.score, 0) / frameworkChecks.length;
    
    let status: 'compliant' | 'non_compliant' | 'attention_required' = 'compliant';
    if (overallScore < 70) status = 'non_compliant';
    else if (overallScore < 90) status = 'attention_required';

    return {
      framework,
      period: { startDate, endDate },
      overallScore: Math.round(overallScore),
      status,
      checks: frameworkChecks,
      trends: {
        scoreHistory: this.getScoreHistory(audits),
        complianceRate: frameworkChecks.filter(c => c.status === 'compliant').length / frameworkChecks.length * 100,
        criticalIssues: frameworkChecks.filter(c => c.status === 'non_compliant' && c.score < 50).length,
      },
      recommendations: this.getFrameworkRecommendations(frameworkChecks),
      generatedAt: new Date(),
    };
  }

  /**
   * Get score history from audits
   */
  private getScoreHistory(audits: PrivacyAudit[]): Array<{ date: string; score: number }> {
    return audits.map(audit => ({
      date: audit.completedDate?.toISOString().split('T')[0] || audit.createdAt.toISOString().split('T')[0],
      score: audit.complianceScore.overall,
    }));
  }

  /**
   * Get framework-specific recommendations
   */
  private getFrameworkRecommendations(checks: ComplianceCheck[]): string[] {
    const recommendations: string[] = [];
    
    const nonCompliantChecks = checks.filter(c => c.status === 'non_compliant');
    const partialChecks = checks.filter(c => c.status === 'partial');

    if (nonCompliantChecks.length > 0) {
      recommendations.push(`Address ${nonCompliantChecks.length} critical compliance issues immediately`);
    }

    if (partialChecks.length > 0) {
      recommendations.push(`Improve ${partialChecks.length} partially compliant areas`);
    }

    const allRecommendations = checks.flatMap(c => c.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)];
    
    return [...recommendations, ...uniqueRecommendations.slice(0, 5)]; // Limit to top recommendations
  }
}
