import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DataProcessingRecord } from '../entities/data-processing-record.entity';
import { PrivacyAudit } from '../entities/privacy-audit.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';

export interface DPIARequest {
  title: string;
  description: string;
  processingActivity: string;
  dataController: string;
  dataProtectionOfficer: string;
  dataCategories: string[];
  dataSubjects: string[];
  processingPurposes: string[];
  legalBasis: string;
  recipientCategories: string[];
  internationalTransfers: string[];
  retentionPeriod: string;
  systematicMonitoring: boolean;
  largeScaleProcessing: boolean;
  specialCategories: boolean;
  highRiskData: boolean;
  innovativeTechnology: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskAssessment {
  id: string;
  category: string;
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number;
  description: string;
  mitigationMeasures: string[];
  residualRisk: number;
  status: 'open' | 'mitigated' | 'accepted' | 'transferred';
}

export interface DPIAReport {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'implemented';
  createdAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  assessedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  processingActivity: string;
  riskAssessments: RiskAssessment[];
  overallRiskScore: number;
  recommendations: string[];
  mitigationPlan: string[];
  complianceChecklist: {
    necessityAndProportionality: boolean;
    dataMinimization: boolean;
    purposeLimitation: boolean;
    storageLimitation: boolean;
    securityMeasures: boolean;
    accountability: boolean;
  };
  stakeholderConsultations: Array<{
    stakeholder: string;
    consultationDate: Date;
    feedback: string;
    concerns: string[];
  }>;
  dataProtectionMeasures: Array<{
    measure: string;
    implemented: boolean;
    effectiveness: string;
    reviewDate: Date;
  }>;
  monitoringPlan: {
    frequency: string;
    metrics: string[];
    responsibilities: string[];
    escalationProcedures: string[];
  };
  documentation: Array<{
    type: string;
    title: string;
    location: string;
    date: Date;
  }>;
}

@Injectable()
export class PrivacyImpactAssessmentService {
  private readonly logger = new Logger(PrivacyImpactAssessmentService.name);
  private readonly dpiaReports = new Map<string, DPIAReport>();

  constructor(
    @InjectRepository(DataProcessingRecord)
    private processingRepository: Repository<DataProcessingRecord>,
    @InjectRepository(PrivacyAudit)
    private auditRepository: Repository<PrivacyAudit>,
    private mailerService: MailerService,
  ) {}

  /**
   * Create a new DPIA
   */
  async createDPIA(request: DPIARequest): Promise<DPIAReport> {
    const reportId = randomUUID();
    
    // Perform initial risk assessment
    const riskAssessments = await this.performRiskAssessment(request);
    
    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(riskAssessments);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(request, riskAssessments);
    
    // Create mitigation plan
    const mitigationPlan = this.createMitigationPlan(riskAssessments);
    
    // Perform compliance checklist
    const complianceChecklist = this.performComplianceChecklist(request);
    
    const dpiaReport: DPIAReport = {
      id: reportId,
      title: request.title,
      description: request.description,
      status: 'draft',
      createdAt: new Date(),
      assessedBy: request.dataController,
      processingActivity: request.processingActivity,
      riskAssessments,
      overallRiskScore,
      recommendations,
      mitigationPlan,
      complianceChecklist,
      stakeholderConsultations: [],
      dataProtectionMeasures: [],
      monitoringPlan: {
        frequency: this.determineMonitoringFrequency(overallRiskScore),
        metrics: this.defineMonitoringMetrics(request),
        responsibilities: ['Data Protection Officer', 'Data Controller', 'IT Security'],
        escalationProcedures: this.defineEscalationProcedures(overallRiskScore),
      },
      documentation: [
        {
          type: 'DPIA Request',
          title: request.title,
          location: 'Internal System',
          date: new Date(),
        },
      ],
    };

    this.dpiaReports.set(reportId, dpiaReport);
    
    // Notify relevant stakeholders
    await this.notifyDPIACreated(dpiaReport);
    
    this.logger.log(`DPIA created: ${reportId} for ${request.processingActivity}`);
    return dpiaReport;
  }

  /**
   * Perform risk assessment
   */
  private async performRiskAssessment(request: DPIARequest): Promise<RiskAssessment[]> {
    const riskAssessments: RiskAssessment[] = [];

    // Privacy risk assessment
    riskAssessments.push(this.assessPrivacyRisk(request));
    
    // Security risk assessment
    riskAssessments.push(this.assessSecurityRisk(request));
    
    // Compliance risk assessment
    riskAssessments.push(this.assessComplianceRisk(request));
    
    // Operational risk assessment
    riskAssessments.push(this.assessOperationalRisk(request));
    
    // Reputational risk assessment
    riskAssessments.push(this.assessReputationalRisk(request));

    // Additional risks based on data categories
    if (request.specialCategories) {
      riskAssessments.push(this.assessSpecialCategoryRisk(request));
    }

    if (request.internationalTransfers.length > 0) {
      riskAssessments.push(this.assessInternationalTransferRisk(request));
    }

    return riskAssessments;
  }

  /**
   * Assess privacy risk
   */
  private assessPrivacyRisk(request: DPIARequest): RiskAssessment {
    let likelihood: RiskAssessment['likelihood'] = 'medium';
    let impact: RiskAssessment['impact'] = 'medium';
    let description = 'Standard privacy risks associated with personal data processing';
    const mitigationMeasures = [
      'Implement privacy by design principles',
      'Conduct privacy impact assessments regularly',
      'Ensure data minimization practices',
      'Maintain transparency with data subjects',
    ];

    // Adjust based on factors
    if (request.specialCategories) {
      likelihood = 'high';
      impact = 'high';
      description = 'Increased risk due to processing of special category data';
      mitigationMeasures.push('Additional safeguards for special category data');
      mitigationMeasures.push('Explicit consent for special category processing');
    }

    if (request.largeScaleProcessing) {
      likelihood = 'high';
      impact = 'high';
      description = 'Increased risk due to large-scale processing activities';
      mitigationMeasures.push('Enhanced oversight for large-scale processing');
      mitigationMeasures.push('Data protection impact assessment required');
    }

    if (request.systematicMonitoring) {
      likelihood = 'high';
      impact = 'medium';
      description = 'Risk associated with systematic monitoring of individuals';
      mitigationMeasures.push('Clear disclosure of monitoring activities');
      mitigationMeasures.push('Provide opt-out mechanisms where possible');
    }

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 20); // Assume 20% risk reduction through mitigation

    return {
      id: randomUUID(),
      category: 'Privacy Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess security risk
   */
  private assessSecurityRisk(request: DPIARequest): RiskAssessment {
    let likelihood: RiskAssessment['likelihood'] = 'medium';
    let impact: RiskAssessment['impact'] = 'medium';
    let description = 'Security risks associated with data processing systems';
    const mitigationMeasures = [
      'Implement encryption at rest and in transit',
      'Establish access control mechanisms',
      'Regular security audits and penetration testing',
      'Incident response and breach notification procedures',
      'Employee security awareness training',
    ];

    // Adjust based on data sensitivity
    if (request.highRiskData || request.specialCategories) {
      likelihood = 'medium';
      impact = 'critical';
      description = 'High security risk due to sensitive data processing';
      mitigationMeasures.push('Enhanced encryption standards');
      mitigationMeasures.push('Multi-factor authentication requirements');
      mitigationMeasures.push('Regular security monitoring');
    }

    if (request.internationalTransfers.length > 0) {
      likelihood = 'high';
      impact = 'high';
      description = 'Increased security risk due to international data transfers';
      mitigationMeasures.push('Secure transfer mechanisms');
      mitigationMeasures.push('Data localization where required');
      mitigationMeasures.push('International security standards compliance');
    }

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 25); // Assume 25% risk reduction through security measures

    return {
      id: randomUUID(),
      category: 'Security Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess compliance risk
   */
  private assessComplianceRisk(request: DPIARequest): RiskAssessment {
    let likelihood: RiskAssessment['likelihood'] = 'medium';
    let impact: RiskAssessment['impact'] = 'medium';
    let description = 'Compliance risks under applicable privacy regulations';
    const mitigationMeasures = [
      'Regular compliance audits',
      'Maintain up-to-date privacy policies',
      'Staff training on privacy regulations',
      'Document compliance procedures',
      'Engage legal counsel for regulatory matters',
    ];

    // Adjust based on processing characteristics
    if (request.systematicMonitoring || request.largeScaleProcessing) {
      likelihood = 'high';
      impact = 'high';
      description = 'Increased compliance risk due to high-risk processing activities';
      mitigationMeasures.push('Mandatory DPIA under GDPR');
      mitigationMeasures.push('Data Protection Officer consultation');
      mitigationMeasures.push('Prior consultation with supervisory authority if needed');
    }

    if (request.internationalTransfers.length > 0) {
      likelihood = 'medium';
      impact = 'high';
      description = 'Compliance risks related to international data transfers';
      mitigationMeasures.push('Ensure adequate protection mechanisms');
      mitigationMeasures.push('Maintain transfer impact assessments');
      mitigationMeasures.push('Monitor regulatory changes in transfer destinations');
    }

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 15); // Assume 15% risk reduction through compliance measures

    return {
      id: randomUUID(),
      category: 'Compliance Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess operational risk
   */
  private assessOperationalRisk(request: DPIARequest): RiskAssessment {
    let likelihood: RiskAssessment['likelihood'] = 'medium';
    let impact: RiskAssessment['impact'] = 'medium';
    let description = 'Operational risks in data processing activities';
    const mitigationMeasures = [
      'Standard operating procedures for data handling',
      'Regular process audits',
      'Business continuity planning',
      'Data quality management',
      'Change management procedures',
    ];

    if (request.innovativeTechnology) {
      likelihood = 'high';
      impact = 'medium';
      description = 'Operational risks associated with innovative technologies';
      mitigationMeasures.push('Technology assessment and testing');
      mitigationMeasures.push('Staff training on new technologies');
      mitigationMeasures.push('Gradual implementation approach');
    }

    if (request.largeScaleProcessing) {
      likelihood = 'medium';
      impact = 'high';
      description = 'Operational risks in large-scale data processing';
      mitigationMeasures.push('Scalable infrastructure planning');
      mitigationMeasures.push('Performance monitoring');
      mitigationMeasures.push('Resource capacity planning');
    }

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 20); // Assume 20% risk reduction through operational measures

    return {
      id: randomUUID(),
      category: 'Operational Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess reputational risk
   */
  private assessReputationalRisk(request: DPIARequest): RiskAssessment {
    let likelihood: RiskAssessment['likelihood'] = 'medium';
    let impact: RiskAssessment['impact'] = 'medium';
    let description = 'Reputational risks from privacy incidents or non-compliance';
    const mitigationMeasures = [
      'Transparent privacy practices',
      'Regular stakeholder communication',
      'Brand monitoring and sentiment analysis',
      'Crisis communication planning',
      'Customer trust building initiatives',
    ];

    if (request.specialCategories || request.highRiskData) {
      likelihood = 'medium';
      impact = 'critical';
      description = 'High reputational risk due to sensitive data processing';
      mitigationMeasures.push('Enhanced transparency for sensitive data use');
      mitigationMeasures.push('Stakeholder engagement programs');
      mitigationMeasures.push('Privacy trust certifications');
    }

    if (request.systematicMonitoring) {
      likelihood = 'high';
      impact = 'high';
      description = 'Reputational risk from monitoring activities';
      mitigationMeasures.push('Clear communication about monitoring purposes');
      mitigationMeasures.push('Privacy-friendly monitoring alternatives');
      mitigationMeasures.push('Independent privacy audits');
    }

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 10); // Assume 10% risk reduction through reputational measures

    return {
      id: randomUUID(),
      category: 'Reputational Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess special category risk
   */
  private assessSpecialCategoryRisk(request: DPIARequest): RiskAssessment {
    const likelihood: RiskAssessment['likelihood'] = 'high';
    const impact: RiskAssessment['impact'] = 'critical';
    const description = 'Specific risks for processing special category data';
    const mitigationMeasures = [
      'Explicit and specific consent',
      'Enhanced security measures',
      'Strict access controls',
      'Regular security audits',
      'Data minimization for special categories',
      'Purpose limitation enforcement',
      'Special category data retention policies',
    ];

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 30); // Assume 30% risk reduction through special measures

    return {
      id: randomUUID(),
      category: 'Special Category Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Assess international transfer risk
   */
  private assessInternationalTransferRisk(request: DPIARequest): RiskAssessment {
    const likelihood: RiskAssessment['likelihood'] = 'medium';
    const impact: RiskAssessment['impact'] = 'high';
    const description = 'Risks associated with international data transfers';
    const mitigationMeasures = [
      'Adequacy decisions verification',
      'Standard contractual clauses',
      'Binding corporate rules',
      'Transfer impact assessments',
      'Monitoring of legal changes in destination countries',
      'Data localization where required',
    ];

    const riskScore = this.calculateRiskScore(likelihood, impact);
    const residualRisk = Math.max(0, riskScore - 25); // Assume 25% risk reduction through transfer safeguards

    return {
      id: randomUUID(),
      category: 'International Transfer Risk',
      likelihood,
      impact,
      riskScore,
      description,
      mitigationMeasures,
      residualRisk,
      status: 'open',
    };
  }

  /**
   * Calculate risk score based on likelihood and impact
   */
  private calculateRiskScore(
    likelihood: RiskAssessment['likelihood'],
    impact: RiskAssessment['impact']
  ): number {
    const likelihoodScores = {
      very_low: 1,
      low: 2,
      medium: 3,
      high: 4,
      very_high: 5,
    };

    const impactScores = {
      very_low: 1,
      low: 2,
      medium: 3,
      high: 4,
      very_high: 5,
    };

    return likelihoodScores[likelihood] * impactScores[impact] * 4; // Scale to 0-100
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(riskAssessments: RiskAssessment[]): number {
    if (riskAssessments.length === 0) return 0;
    
    const totalScore = riskAssessments.reduce((sum, risk) => sum + risk.residualRisk, 0);
    return Math.round(totalScore / riskAssessments.length);
  }

  /**
   * Generate recommendations based on risk assessment
   */
  private generateRecommendations(request: DPIARequest, riskAssessments: RiskAssessment[]): string[] {
    const recommendations: string[] = [];
    const highRisks = riskAssessments.filter(r => r.residualRisk > 60);

    if (highRisks.length > 0) {
      recommendations.push('Implement additional safeguards for high-risk areas');
      recommendations.push('Consider alternative processing methods with lower risk');
      recommendations.push('Engage Data Protection Officer for review');
    }

    if (request.specialCategories) {
      recommendations.push('Ensure explicit consent for all special category processing');
      recommendations.push('Implement enhanced security for special category data');
    }

    if (request.internationalTransfers.length > 0) {
      recommendations.push('Verify adequacy of protection in destination countries');
      recommendations.push('Maintain comprehensive transfer documentation');
    }

    if (request.systematicMonitoring) {
      recommendations.push('Provide clear information about monitoring activities');
      recommendations.push('Implement privacy-friendly monitoring alternatives');
    }

    return recommendations;
  }

  /**
   * Create mitigation plan
   */
  private createMitigationPlan(riskAssessments: RiskAssessment[]): string[] {
    const mitigationPlan: string[] = [];
    
    // Group mitigation measures by category
    const measuresByCategory = riskAssessments.reduce((grouped, risk) => {
      if (!grouped[risk.category]) {
        grouped[risk.category] = [];
      }
      grouped[risk.category].push(...risk.mitigationMeasures);
      return grouped;
    }, {} as Record<string, string[]>);

    // Create prioritized mitigation plan
    for (const [category, measures] of Object.entries(measuresByCategory)) {
      mitigationPlan.push(`${category}:`);
      const uniqueMeasures = [...new Set(measures)];
      uniqueMeasures.forEach(measure => {
        mitigationPlan.push(`  - ${measure}`);
      });
    }

    return mitigationPlan;
  }

  /**
   * Perform compliance checklist
   */
  private performComplianceChecklist(request: DPIARequest): DPIAReport['complianceChecklist'] {
    return {
      necessityAndProportionality: this.checkNecessityAndProportionality(request),
      dataMinimization: this.checkDataMinimization(request),
      purposeLimitation: this.checkPurposeLimitation(request),
      storageLimitation: this.checkStorageLimitation(request),
      securityMeasures: this.checkSecurityMeasures(request),
      accountability: this.checkAccountability(request),
    };
  }

  /**
   * Check necessity and proportionality
   */
  private checkNecessityAndProportionality(request: DPIARequest): boolean {
    // Simplified check - in reality, this would involve detailed analysis
    return request.processingPurposes.length > 0 && request.legalBasis.length > 0;
  }

  /**
   * Check data minimization
   */
  private checkDataMinimization(request: DPIARequest): boolean {
    // Simplified check - in reality, this would analyze actual data collected
    return request.dataCategories.length > 0 && request.retentionPeriod.length > 0;
  }

  /**
   * Check purpose limitation
   */
  private checkPurposeLimitation(request: DPIARequest): boolean {
    // Simplified check - in reality, this would verify compatible processing
    return request.processingPurposes.length > 0;
  }

  /**
   * Check storage limitation
   */
  private checkStorageLimitation(request: DPIARequest): boolean {
    // Simplified check - in reality, this would verify retention policies
    return request.retentionPeriod.length > 0;
  }

  /**
   * Check security measures
   */
  private checkSecurityMeasures(request: DPIARequest): boolean {
    // Simplified check - in reality, this would verify security implementation
    return true; // Assume security measures are in place
  }

  /**
   * Check accountability
   */
  private checkAccountability(request: DPIARequest): boolean {
    // Simplified check - in reality, this would verify governance structures
    return request.dataController.length > 0 && request.dataProtectionOfficer.length > 0;
  }

  /**
   * Determine monitoring frequency based on risk score
   */
  private determineMonitoringFrequency(riskScore: number): string {
    if (riskScore >= 80) return 'weekly';
    if (riskScore >= 60) return 'monthly';
    if (riskScore >= 40) return 'quarterly';
    return 'semi-annually';
  }

  /**
   * Define monitoring metrics
   */
  private defineMonitoringMetrics(request: DPIARequest): string[] {
    const metrics = [
      'Data subject request volume',
      'Security incident count',
      'Compliance audit results',
      'Data processing volume trends',
    ];

    if (request.specialCategories) {
      metrics.push('Special category data access logs');
    }

    if (request.internationalTransfers.length > 0) {
      metrics.push('International transfer compliance');
    }

    return metrics;
  }

  /**
   * Define escalation procedures
   */
  private defineEscalationProcedures(riskScore: number): string[] {
    const procedures = [
      'Immediate notification of DPO for high-risk incidents',
      'Monthly review meetings with stakeholders',
      'Quarterly compliance reporting to management',
    ];

    if (riskScore >= 80) {
      procedures.push('Immediate escalation to executive team');
      procedures.push('Supervisory authority notification if required');
    }

    return procedures;
  }

  /**
   * Notify DPIA created
   */
  private async notifyDPIACreated(dpiaReport: DPIAReport): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'dpo@gathera.io',
        subject: `New DPIA Created: ${dpiaReport.title}`,
        template: 'dpia-created',
        context: {
          dpiaReport,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send DPIA notification', error);
    }
  }

  /**
   * Get DPIA by ID
   */
  async getDPIA(id: string): Promise<DPIAReport> {
    const dpia = this.dpiaReports.get(id);
    if (!dpia) {
      throw new NotFoundException('DPIA not found');
    }
    return dpia;
  }

  /**
   * Update DPIA status
   */
  async updateDPIAStatus(
    id: string,
    status: DPIAReport['status'],
    reviewedBy?: string,
    approvedBy?: string
  ): Promise<DPIAReport> {
    const dpia = await this.getDPIA(id);
    
    dpia.status = status;
    
    if (status === 'under_review' && reviewedBy) {
      dpia.reviewedBy = reviewedBy;
      dpia.reviewedAt = new Date();
    }
    
    if (status === 'approved' && approvedBy) {
      dpia.approvedBy = approvedBy;
      dpia.approvedAt = new Date();
    }

    this.dpiaReports.set(id, dpia);
    
    // Notify status change
    await this.notifyDPIAStatusUpdate(dpia);
    
    return dpia;
  }

  /**
   * Notify DPIA status update
   */
  private async notifyDPIAStatusUpdate(dpiaReport: DPIAReport): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'dpo@gathera.io',
        subject: `DPIA Status Update: ${dpiaReport.title}`,
        template: 'dpia-status-update',
        context: {
          dpiaReport,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send DPIA status update notification', error);
    }
  }

  /**
   * Get all DPIAs
   */
  getAllDPIAs(): DPIAReport[] {
    return Array.from(this.dpiaReports.values());
  }

  /**
   * Get DPIA summary statistics
   */
  getDPIAStatistics(): any {
    const dpiaList = Array.from(this.dpiaReports.values());
    
    return {
      totalDPIAs: dpiaList.length,
      byStatus: {
        draft: dpiaList.filter(d => d.status === 'draft').length,
        under_review: dpiaList.filter(d => d.status === 'under_review').length,
        approved: dpiaList.filter(d => d.status === 'approved').length,
        rejected: dpiaList.filter(d => d.status === 'rejected').length,
        implemented: dpiaList.filter(d => d.status === 'implemented').length,
      },
      averageRiskScore: dpiaList.reduce((sum, d) => sum + d.overallRiskScore, 0) / dpiaList.length,
      highRiskDPIAs: dpiaList.filter(d => d.overallRiskScore >= 70).length,
      recentDPIAs: dpiaList.filter(d => 
        d.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
    };
  }
}
