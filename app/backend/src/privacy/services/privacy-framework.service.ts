import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { PrivacyPolicy } from '../entities/privacy-policy.entity';
import { PrivacyConsent } from '../entities/privacy-consent.entity';
import { DataProcessingRecord } from '../entities/data-processing-record.entity';
import { DataBreach } from '../entities/data-breach.entity';
import { PrivacyAudit } from '../entities/privacy-audit.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '@nestjs-modules/mailer';

export interface ComplianceFramework {
  name: string;
  version: string;
  requirements: ComplianceRequirement[];
  auditFrequency: string;
  reportingRequirements: ReportingRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  evidenceRequired: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReportingRequirement {
  type: string;
  frequency: string;
  recipients: string[];
  template: string;
  dataRequired: string[];
}

export interface PrivacyMetrics {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  dataSubjectRequests: number;
  breachIncidents: number;
  complianceScore: number;
  auditFindings: number;
  dataProcessingRecords: number;
}

@Injectable()
export class PrivacyFrameworkService {
  private readonly logger = new Logger(PrivacyFrameworkService.name);

  constructor(
    @InjectRepository(PrivacyPolicy)
    private privacyPolicyRepository: Repository<PrivacyPolicy>,
    @InjectRepository(PrivacyConsent)
    private privacyConsentRepository: Repository<PrivacyConsent>,
    @InjectRepository(DataProcessingRecord)
    private dataProcessingRepository: Repository<DataProcessingRecord>,
    @InjectRepository(DataBreach)
    private dataBreachRepository: Repository<DataBreach>,
    @InjectRepository(PrivacyAudit)
    private privacyAuditRepository: Repository<PrivacyAudit>,
    private mailerService: MailerService,
  ) {}

  /**
   * Get predefined compliance frameworks
   */
  getComplianceFrameworks(): ComplianceFramework[] {
    return [
      {
        name: 'GDPR',
        version: '2018',
        requirements: this.getGDPRRequirements(),
        auditFrequency: 'annual',
        reportingRequirements: this.getGDPRReportingRequirements(),
      },
      {
        name: 'CCPA',
        version: '2020',
        requirements: this.getCCPARequirements(),
        auditFrequency: 'biennial',
        reportingRequirements: this.getCCPAReportingRequirements(),
      },
      {
        name: 'FERPA',
        version: '2022',
        requirements: this.getFERPARequirements(),
        auditFrequency: 'annual',
        reportingRequirements: this.getFERPAReportingRequirements(),
      },
    ];
  }

  /**
   * GDPR compliance requirements
   */
  private getGDPRRequirements(): ComplianceRequirement[] {
    return [
      {
        id: 'GDPR_ART_5',
        title: 'Principles of processing personal data',
        description: 'Process personal data lawfully, fairly and transparently',
        category: 'Data Protection Principles',
        mandatory: true,
        evidenceRequired: ['privacy_policy', 'consent_records', 'data_processing_records'],
        riskLevel: 'critical',
      },
      {
        id: 'GDPR_ART_7',
        title: 'Conditions for consent',
        description: 'Obtain clear, specific, informed consent for data processing',
        category: 'Consent Management',
        mandatory: true,
        evidenceRequired: ['consent_records', 'privacy_policy', 'withdrawal_mechanisms'],
        riskLevel: 'critical',
      },
      {
        id: 'GDPR_ART_15',
        title: 'Right of access',
        description: 'Provide data subjects with access to their personal data',
        category: 'Data Subject Rights',
        mandatory: true,
        evidenceRequired: ['access_request_logs', 'response_times', 'data_export_formats'],
        riskLevel: 'high',
      },
      {
        id: 'GDPR_ART_16',
        title: 'Right to rectification',
        description: 'Allow data subjects to correct inaccurate personal data',
        category: 'Data Subject Rights',
        mandatory: true,
        evidenceRequired: ['rectification_requests', 'update_logs', 'verification_processes'],
        riskLevel: 'high',
      },
      {
        id: 'GDPR_ART_17',
        title: 'Right to erasure',
        description: 'Enable data subjects to request deletion of their personal data',
        category: 'Data Subject Rights',
        mandatory: true,
        evidenceRequired: ['deletion_requests', 'anonymization_logs', 'retention_policies'],
        riskLevel: 'critical',
      },
      {
        id: 'GDPR_ART_21',
        title: 'Right to object',
        description: 'Allow data subjects to object to processing of their personal data',
        category: 'Data Subject Rights',
        mandatory: true,
        evidenceRequired: ['objection_requests', 'processing_stops', 'alternative_solutions'],
        riskLevel: 'high',
      },
      {
        id: 'GDPR_ART_32',
        title: 'Security of processing',
        description: 'Implement appropriate technical and organizational security measures',
        category: 'Data Security',
        mandatory: true,
        evidenceRequired: ['security_assessments', 'encryption_status', 'access_controls'],
        riskLevel: 'critical',
      },
      {
        id: 'GDPR_ART_33',
        title: 'Notification of personal data breach',
        description: 'Report data breaches to supervisory authority within 72 hours',
        category: 'Breach Management',
        mandatory: true,
        evidenceRequired: ['breach_detection_logs', 'notification_records', 'response_times'],
        riskLevel: 'critical',
      },
      {
        id: 'GDPR_ART_35',
        title: 'Data protection impact assessment',
        description: 'Conduct DPIA for high-risk processing activities',
        category: 'Risk Assessment',
        mandatory: true,
        evidenceRequired: ['dpia_reports', 'risk_assessments', 'mitigation_plans'],
        riskLevel: 'high',
      },
      {
        id: 'GDPR_ART_58',
        title: 'Supervisory authority',
        description: 'Cooperate with supervisory authority and provide access to data',
        category: 'Oversight',
        mandatory: true,
        evidenceRequired: ['authority_communications', 'inspection_logs', 'compliance_reports'],
        riskLevel: 'medium',
      },
    ];
  }

  /**
   * CCPA compliance requirements
   */
  private getCCPARequirements(): ComplianceRequirement[] {
    return [
      {
        id: 'CCPA_1798.100',
        title: 'Right to Know',
        description: 'Inform consumers about personal data collected and used',
        category: 'Transparency',
        mandatory: true,
        evidenceRequired: ['privacy_policy', 'data_inventory', 'collection_disclosures'],
        riskLevel: 'high',
      },
      {
        id: 'CCPA_1798.105',
        title: 'Right to Delete',
        description: 'Delete personal data upon consumer request',
        category: 'Data Subject Rights',
        mandatory: true,
        evidenceRequired: ['deletion_requests', 'verification_logs', 'service_provider_notifications'],
        riskLevel: 'critical',
      },
      {
        id: 'CCPA_1798.120',
        title: 'Right to Opt-Out',
        description: 'Allow consumers to opt-out of sale of personal data',
        category: 'Data Sharing',
        mandatory: true,
        evidenceRequired: ['opt_out_mechanisms', 'do_not_sell_signals', 'third_party_restrictions'],
        riskLevel: 'high',
      },
      {
        id: 'CCPA_1798.130',
        title: 'Non-Discrimination',
        description: 'Do not discriminate against consumers exercising privacy rights',
        category: 'Fair Treatment',
        mandatory: true,
        evidenceRequired: ['pricing_consistency', 'service_level_logs', 'access_policies'],
        riskLevel: 'medium',
      },
    ];
  }

  /**
   * FERPA compliance requirements
   */
  private getFERPARequirements(): ComplianceRequirement[] {
    return [
      {
        id: 'FERPA_99.31',
        title: 'Annual Notification',
        description: 'Provide annual notification of rights under FERPA',
        category: 'Notification',
        mandatory: true,
        evidenceRequired: ['annual_notices', 'distribution_logs', 'acknowledgments'],
        riskLevel: 'medium',
      },
      {
        id: 'FERPA_99.30',
        title: 'Directory Information',
        description: 'Allow parents to opt-out of directory information disclosure',
        category: 'Directory Information',
        mandatory: true,
        evidenceRequired: ['directory_policies', 'opt_out_forms', 'disclosure_logs'],
        riskLevel: 'medium',
      },
      {
        id: 'FERPA_99.32',
        title: 'Record of Access',
        description: 'Maintain records of requests for access to education records',
        category: 'Access Control',
        mandatory: true,
        evidenceRequired: ['access_logs', 'request_forms', 'disclosure_records'],
        riskLevel: 'high',
      },
    ];
  }

  /**
   * GDPR reporting requirements
   */
  private getGDPRReportingRequirements(): ReportingRequirement[] {
    return [
      {
        type: 'data_subject_requests',
        frequency: 'monthly',
        recipients: ['dpo', 'compliance_officer'],
        template: 'gdpr_dsr_report',
        dataRequired: ['request_count', 'response_times', 'outstanding_requests'],
      },
      {
        type: 'breach_notifications',
        frequency: 'as_needed',
        recipients: ['supervisory_authority', 'dpo'],
        template: 'gdpr_breach_notification',
        dataRequired: ['breach_details', 'affected_data', 'mitigation_measures'],
      },
      {
        type: 'compliance_audit',
        frequency: 'annual',
        recipients: ['board', 'dpo', 'compliance_officer'],
        template: 'gdpr_compliance_report',
        dataRequired: ['audit_findings', 'risk_assessments', 'remediation_status'],
      },
    ];
  }

  /**
   * CCPA reporting requirements
   */
  private getCCPAReportingRequirements(): ReportingRequirement[] {
    return [
      {
        type: 'consumer_requests',
        frequency: 'quarterly',
        recipients: ['compliance_officer', 'legal_team'],
        template: 'ccpa_consumer_requests',
        dataRequired: ['request_types', 'response_times', 'verification_methods'],
      },
      {
        type: 'data_inventory',
        frequency: 'semi-annual',
        recipients: ['compliance_officer', 'engineering_team'],
        template: 'ccpa_data_inventory',
        dataRequired: ['data_categories', 'collection_purposes', 'sharing_practices'],
      },
    ];
  }

  /**
   * FERPA reporting requirements
   */
  private getFERPAReportingRequirements(): ReportingRequirement[] {
    return [
      {
        type: 'directory_opt_outs',
        frequency: 'annual',
        recipients: ['registrar', 'compliance_officer'],
        template: 'ferpa_directory_report',
        dataRequired: ['opt_out_count', 'directory_disclosures', 'parent_requests'],
      },
      {
        type: 'record_access',
        frequency: 'annual',
        recipients: ['registrar', 'compliance_officer'],
        template: 'ferpa_access_report',
        dataRequired: ['access_requests', 'disclosure_logs', 'third_party_access'],
      },
    ];
  }

  /**
   * Get comprehensive privacy metrics
   */
  async getPrivacyMetrics(): Promise<PrivacyMetrics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalConsents,
      activeConsents,
      withdrawnConsents,
      dataSubjectRequests,
      breachIncidents,
      auditFindings,
      dataProcessingRecords,
    ] = await Promise.all([
      this.privacyConsentRepository.count(),
      this.privacyConsentRepository.count({ where: { status: 'granted' } }),
      this.privacyConsentRepository.count({ where: { status: 'withdrawn' } }),
      this.getDataSubjectRequestsCount(thirtyDaysAgo),
      this.dataBreachRepository.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.privacyAuditRepository.query(
        'SELECT COUNT(*) as count FROM privacy_audits WHERE status = $1 AND completedDate >= $2',
        ['completed', thirtyDaysAgo]
      ),
      this.dataProcessingRepository.count({ where: { status: 'active' } }),
    ]);

    const complianceScore = await this.calculateComplianceScore();

    return {
      totalConsents,
      activeConsents,
      withdrawnConsents,
      dataSubjectRequests,
      breachIncidents,
      complianceScore,
      auditFindings: parseInt(auditFindings[0]?.count || '0'),
      dataProcessingRecords,
    };
  }

  /**
   * Calculate overall compliance score
   */
  private async calculateComplianceScore(): Promise<number> {
    const frameworks = this.getComplianceFrameworks();
    let totalScore = 0;
    let frameworkCount = 0;

    for (const framework of frameworks) {
      const score = await this.evaluateFrameworkCompliance(framework);
      totalScore += score;
      frameworkCount++;
    }

    return frameworkCount > 0 ? Math.round(totalScore / frameworkCount) : 0;
  }

  /**
   * Evaluate compliance for a specific framework
   */
  private async evaluateFrameworkCompliance(framework: ComplianceFramework): Promise<number> {
    let totalRequirements = framework.requirements.length;
    let compliantRequirements = 0;

    for (const requirement of framework.requirements) {
      const isCompliant = await this.checkRequirementCompliance(requirement);
      if (isCompliant) {
        compliantRequirements++;
      }
    }

    return totalRequirements > 0 ? Math.round((compliantRequirements / totalRequirements) * 100) : 0;
  }

  /**
   * Check if a specific requirement is compliant
   */
  private async checkRequirementCompliance(requirement: ComplianceRequirement): Promise<boolean> {
    // This would involve checking evidence, policies, and controls
    // For now, return a simplified compliance check
    switch (requirement.category) {
      case 'Consent Management':
        const activePolicies = await this.privacyPolicyRepository.count({ where: { status: 'active' } });
        return activePolicies > 0;
      
      case 'Data Subject Rights':
        const recentConsents = await this.privacyConsentRepository.count({
          where: { createdAt: MoreThanOrEqual(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) }
        });
        return recentConsents > 0;
      
      case 'Data Security':
        const activeRecords = await this.dataProcessingRepository.count({ where: { status: 'active' } });
        return activeRecords > 0;
      
      default:
        return true; // Default to compliant for demo purposes
    }
  }

  /**
   * Get data subject requests count
   */
  private async getDataSubjectRequestsCount(since: Date): Promise<number> {
    // This would typically query a data subject requests table
    // For now, return a simplified count based on consent withdrawals
    return this.privacyConsentRepository.count({
      where: { 
        withdrawnAt: MoreThanOrEqual(since),
        status: 'withdrawn'
      }
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(framework: string): Promise<any> {
    const frameworkData = this.getComplianceFrameworks().find(f => f.name === framework);
    if (!frameworkData) {
      throw new NotFoundException(`Framework ${framework} not found`);
    }

    const metrics = await this.getPrivacyMetrics();
    const complianceScore = await this.evaluateFrameworkCompliance(frameworkData);
    
    const report = {
      framework,
      generatedAt: new Date(),
      complianceScore,
      metrics,
      requirements: frameworkData.requirements.map(req => ({
        ...req,
        compliant: this.checkRequirementCompliance(req),
      })),
      recommendations: await this.generateRecommendations(frameworkData),
    };

    return report;
  }

  /**
   * Generate compliance recommendations
   */
  private async generateRecommendations(framework: ComplianceFramework): Promise<string[]> {
    const recommendations: string[] = [];
    const metrics = await this.getPrivacyMetrics();

    if (metrics.complianceScore < 80) {
      recommendations.push('Review and update privacy policies to improve compliance');
    }

    if (metrics.breachIncidents > 0) {
      recommendations.push('Strengthen security measures to prevent data breaches');
    }

    if (metrics.withdrawnConsents > metrics.activeConsents * 0.1) {
      recommendations.push('Review consent mechanisms and improve user experience');
    }

    return recommendations;
  }

  /**
   * Scheduled compliance monitoring
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledComplianceCheck() {
    this.logger.log('Running scheduled compliance check');
    
    try {
      const metrics = await this.getPrivacyMetrics();
      
      // Alert on critical issues
      if (metrics.breachIncidents > 0) {
        await this.sendAlert('critical', 'Data breach incidents detected', {
          count: metrics.breachIncidents,
          action: 'Immediate investigation required',
        });
      }

      if (metrics.complianceScore < 70) {
        await this.sendAlert('warning', 'Low compliance score detected', {
          score: metrics.complianceScore,
          action: 'Review compliance measures',
        });
      }

      this.logger.log('Compliance check completed', metrics);
    } catch (error) {
      this.logger.error('Error during compliance check', error);
    }
  }

  /**
   * Send compliance alert
   */
  private async sendAlert(level: string, message: string, data: any) {
    try {
      await this.mailerService.sendMail({
        to: 'compliance@gathera.io',
        subject: `[${level.toUpperCase()}] Privacy Compliance Alert`,
        template: 'compliance-alert',
        context: {
          level,
          message,
          data,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send compliance alert', error);
    }
  }
}
