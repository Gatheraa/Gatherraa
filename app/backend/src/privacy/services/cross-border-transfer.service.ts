import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataProcessingRecord } from '../entities/data-processing-record.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { randomUUID } from 'crypto';

export interface TransferRequest {
  id: string;
  sourceCountry: string;
  destinationCountry: string;
  dataCategories: string[];
  dataSubjects: string[];
  transferPurpose: string;
  dataVolume: number;
  transferFrequency: string;
  legalBasis: string;
  protectionMechanism: string;
  recipientType: string;
  recipientName: string;
  technicalMeasures: string[];
  organizationalMeasures: string[];
  retentionPeriod: string;
  deletionMethod: string;
}

export interface AdequacyDecision {
  country: string;
  decisionDate: Date;
  status: 'adequate' | 'inadequate' | 'conditional';
  conditions: string[];
  limitations: string[];
  reviewDate: Date;
  lastUpdated: Date;
}

export interface TransferMechanism {
  type: 'adequacy_decision' | 'standard_contractual_clauses' | 'binding_corporate_rules' | 'derogations' | 'certification';
  name: string;
  description: string;
  applicableCountries: string[];
  requirements: string[];
  limitations: string[];
  validityPeriod: string;
  renewalRequired: boolean;
}

export interface TransferImpactAssessment {
  id: string;
  transferRequest: TransferRequest;
  destinationCountryRisk: 'low' | 'medium' | 'high' | 'critical';
  dataProtectionLevel: 'equivalent' | 'substantially_equivalent' | 'insufficient';
  risks: Array<{
    category: string;
    description: string;
    likelihood: string;
    impact: string;
    mitigation: string;
  }>;
  recommendations: string[];
  additionalSafeguards: string[];
  assessmentDate: Date;
  assessedBy: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface TransferRecord {
  id: string;
  transferRequest: TransferRequest;
  mechanism: TransferMechanism;
  impactAssessment: TransferImpactAssessment;
  status: 'pending' | 'approved' | 'active' | 'suspended' | 'terminated';
  createdAt: Date;
  approvedAt?: Date;
  suspendedAt?: Date;
  terminatedAt?: Date;
  lastTransferDate?: Date;
  transferCount: number;
  monitoringRequired: boolean;
  nextReviewDate: Date;
  complianceChecks: {
    adequacyDecision: boolean;
    safeguardsInPlace: boolean;
    documentationComplete: boolean;
    consentObtained: boolean;
  };
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    userId: string;
    details: string;
  }>;
}

@Injectable()
export class CrossBorderTransferService {
  private readonly logger = new Logger(CrossBorderTransferService.name);
  private readonly transferRecords = new Map<string, TransferRecord>();
  private readonly adequacyDecisions = new Map<string, AdequacyDecision>();
  private readonly transferMechanisms: TransferMechanism[] = [];

  constructor(
    @InjectRepository(DataProcessingRecord)
    private processingRepository: Repository<DataProcessingRecord>,
    private mailerService: MailerService,
  ) {
    this.initializeAdequacyDecisions();
    this.initializeTransferMechanisms();
  }

  /**
   * Initialize adequacy decisions
   */
  private initializeAdequacyDecisions(): void {
    // EU adequacy decisions (simplified for demo)
    const adequacyDecisions: AdequacyDecision[] = [
      {
        country: 'United Kingdom',
        decisionDate: new Date('2021-06-28'),
        status: 'adequate',
        conditions: [],
        limitations: [],
        reviewDate: new Date('2025-06-28'),
        lastUpdated: new Date('2021-06-28'),
      },
      {
        country: 'Switzerland',
        decisionDate: new Date('2000-07-25'),
        status: 'adequate',
        conditions: [],
        limitations: [],
        reviewDate: new Date('2025-07-25'),
        lastUpdated: new Date('2021-06-28'),
      },
      {
        country: 'Japan',
        decisionDate: new Date('2019-01-23'),
        status: 'adequate',
        conditions: [],
        limitations: [],
        reviewDate: new Date('2024-01-23'),
        lastUpdated: new Date('2019-01-23'),
      },
      {
        country: 'Canada',
        decisionDate: new Date('2002-04-20'),
        status: 'conditional',
        conditions: ['Commercial organizations only', 'Subject to Canadian privacy laws'],
        limitations: ['Not applicable to public sector'],
        reviewDate: new Date('2025-04-20'),
        lastUpdated: new Date('2002-04-20'),
      },
      {
        country: 'United States',
        decisionDate: new Date('2023-10-10'),
        status: 'adequate',
        conditions: ['Data Privacy Framework compliance'],
        limitations: ['Limited to certified organizations'],
        reviewDate: new Date('2026-10-10'),
        lastUpdated: new Date('2023-10-10'),
      },
    ];

    adequacyDecisions.forEach(decision => {
      this.adequacyDecisions.set(decision.country, decision);
    });
  }

  /**
   * Initialize transfer mechanisms
   */
  private initializeTransferMechanisms(): void {
    this.transferMechanisms = [
      {
        type: 'adequacy_decision',
        name: 'Adequacy Decision',
        description: 'Transfer to countries with EU adequacy decisions',
        applicableCountries: ['United Kingdom', 'Switzerland', 'Japan', 'Canada', 'United States'],
        requirements: ['Verify current adequacy status', 'Monitor decision changes'],
        limitations: ['Only for countries with current adequacy decisions'],
        validityPeriod: 'Until adequacy decision is withdrawn',
        renewalRequired: false,
      },
      {
        type: 'standard_contractual_clauses',
        name: 'Standard Contractual Clauses (SCCs)',
        description: 'EU-approved standard contractual clauses for data transfers',
        applicableCountries: ['All countries'], // Can be used globally
        requirements: ['Signed SCCs with data importer', 'Data importer compliance verification'],
        limitations: ['May require additional safeguards for high-risk transfers'],
        validityPeriod: 'Indefinite',
        renewalRequired: false,
      },
      {
        type: 'binding_corporate_rules',
        name: 'Binding Corporate Rules (BCRs)',
        description: 'Internal rules for intra-group data transfers',
        applicableCountries: ['All countries'], // For multinational corporations
        requirements: ['BCR approval by supervisory authority', 'Internal compliance program'],
        limitations: ['Only for transfers within corporate group'],
        validityPeriod: '5 years',
        renewalRequired: true,
      },
      {
        type: 'derogations',
        name: 'Derogations for Specific Situations',
        description: 'Limited derogations for specific transfer situations',
        applicableCountries: ['All countries'],
        requirements: ['Explicit consent', 'Contractual necessity', 'Important public interest'],
        limitations: ['Limited to specific circumstances', 'Not for systematic transfers'],
        validityPeriod: 'Case by case',
        renewalRequired: false,
      },
      {
        type: 'certification',
        name: 'Certification Mechanisms',
        description: 'Certified data protection mechanisms',
        applicableCountries: ['Countries with recognized certifications'],
        requirements: ['Valid certification', 'Regular audits', 'Compliance monitoring'],
        limitations: ['Depends on certification recognition'],
        validityPeriod: 'Certification validity period',
        renewalRequired: true,
      },
    ];
  }

  /**
   * Create a new cross-border transfer request
   */
  async createTransferRequest(request: TransferRequest): Promise<TransferRecord> {
    // Validate transfer request
    await this.validateTransferRequest(request);

    // Perform impact assessment
    const impactAssessment = await this.performTransferImpactAssessment(request);

    // Determine appropriate transfer mechanism
    const mechanism = this.determineTransferMechanism(request, impactAssessment);

    // Create transfer record
    const transferRecord: TransferRecord = {
      id: randomUUID(),
      transferRequest: request,
      mechanism,
      impactAssessment,
      status: 'pending',
      createdAt: new Date(),
      transferCount: 0,
      monitoringRequired: impactAssessment.destinationCountryRisk !== 'low',
      nextReviewDate: this.calculateNextReviewDate(impactAssessment.destinationCountryRisk),
      complianceChecks: {
        adequacyDecision: mechanism.type === 'adequacy_decision',
        safeguardsInPlace: true, // Assume safeguards are in place for demo
        documentationComplete: true,
        consentObtained: this.checkConsentRequirement(request),
      },
      auditTrail: [{
        timestamp: new Date(),
        action: 'transfer_request_created',
        userId: 'system',
        details: `Transfer request created for ${request.destinationCountry}`,
      }],
    };

    this.transferRecords.set(transferRecord.id, transferRecord);

    // Notify relevant stakeholders
    await this.notifyTransferRequestCreated(transferRecord);

    this.logger.log(`Transfer request created: ${transferRecord.id} for ${request.destinationCountry}`);
    return transferRecord;
  }

  /**
   * Validate transfer request
   */
  private async validateTransferRequest(request: TransferRequest): Promise<void> {
    if (!request.sourceCountry || !request.destinationCountry) {
      throw new BadRequestException('Source and destination countries are required');
    }

    if (request.sourceCountry === request.destinationCountry) {
      throw new BadRequestException('Source and destination countries must be different');
    }

    if (!request.dataCategories || request.dataCategories.length === 0) {
      throw new BadRequestException('Data categories must be specified');
    }

    if (!request.legalBasis) {
      throw new BadRequestException('Legal basis for transfer must be specified');
    }

    if (!request.protectionMechanism) {
      throw new BadRequestException('Protection mechanism must be specified');
    }
  }

  /**
   * Perform transfer impact assessment
   */
  private async performTransferImpactAssessment(request: TransferRequest): Promise<TransferImpactAssessment> {
    const destinationCountryRisk = this.assessCountryRisk(request.destinationCountry);
    const dataProtectionLevel = this.assessDataProtectionLevel(request.destinationCountry);
    const risks = this.identifyTransferRisks(request, destinationCountryRisk, dataProtectionLevel);
    const recommendations = this.generateTransferRecommendations(request, risks);
    const additionalSafeguards = this.identifyAdditionalSafeguards(request, risks);

    return {
      id: randomUUID(),
      transferRequest: request,
      destinationCountryRisk,
      dataProtectionLevel,
      risks,
      recommendations,
      additionalSafeguards,
      assessmentDate: new Date(),
      assessedBy: 'Data Protection Officer',
      approved: false,
    };
  }

  /**
   * Assess country risk level
   */
  private assessCountryRisk(country: string): TransferImpactAssessment['destinationCountryRisk'] {
    const adequacyDecision = this.adequacyDecisions.get(country);
    
    if (adequacyDecision) {
      switch (adequacyDecision.status) {
        case 'adequate':
          return 'low';
        case 'conditional':
          return 'medium';
        case 'inadequate':
          return 'high';
      }
    }

    // Default risk assessment for countries without adequacy decisions
    const highRiskCountries = ['China', 'Russia', 'Iran', 'North Korea'];
    const mediumRiskCountries = ['India', 'Brazil', 'South Africa', 'Mexico'];

    if (highRiskCountries.includes(country)) {
      return 'critical';
    } else if (mediumRiskCountries.includes(country)) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  /**
   * Assess data protection level
   */
  private assessDataProtectionLevel(country: string): TransferImpactAssessment['dataProtectionLevel'] {
    const adequacyDecision = this.adequacyDecisions.get(country);
    
    if (adequacyDecision && adequacyDecision.status === 'adequate') {
      return 'equivalent';
    }

    if (adequacyDecision && adequacyDecision.status === 'conditional') {
      return 'substantially_equivalent';
    }

    // Default assessment based on known privacy frameworks
    const equivalentCountries = ['United Kingdom', 'Switzerland', 'Japan', 'Canada', 'United States'];
    const substantiallyEquivalentCountries = ['Australia', 'New Zealand', 'South Korea', 'Singapore'];

    if (equivalentCountries.includes(country)) {
      return 'equivalent';
    } else if (substantiallyEquivalentCountries.includes(country)) {
      return 'substantially_equivalent';
    } else {
      return 'insufficient';
    }
  }

  /**
   * Identify transfer risks
   */
  private identifyTransferRisks(
    request: TransferRequest,
    countryRisk: string,
    protectionLevel: string
  ): TransferImpactAssessment['risks'] {
    const risks: TransferImpactAssessment['risks'] = [];

    // Country-specific risks
    if (countryRisk === 'critical' || countryRisk === 'high') {
      risks.push({
        category: 'Legal and Regulatory Risk',
        description: 'Destination country has inadequate data protection laws',
        likelihood: 'high',
        impact: 'high',
        mitigation: 'Implement additional safeguards and contractual protections',
      });
    }

    // Data protection level risks
    if (protectionLevel === 'insufficient') {
      risks.push({
        category: 'Data Protection Risk',
        description: 'Destination country lacks equivalent data protection standards',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'Use Standard Contractual Clauses and additional technical measures',
      });
    }

    // Data category risks
    if (request.dataCategories.some(cat => ['special_categories', 'health_data', 'biometric_data'].includes(cat))) {
      risks.push({
        category: 'Sensitive Data Risk',
        description: 'Transfer of sensitive data to higher-risk jurisdiction',
        likelihood: 'medium',
        impact: 'critical',
        mitigation: 'Enhanced encryption, strict access controls, explicit consent',
      });
    }

    // Volume and frequency risks
    if (request.dataVolume > 1000000 || request.transferFrequency === 'continuous') {
      risks.push({
        category: 'Scale Risk',
        description: 'Large-scale or continuous data transfers increase exposure',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: 'Regular monitoring, transfer logging, periodic reviews',
      });
    }

    // Recipient risks
    if (request.recipientType === 'third_party') {
      risks.push({
        category: 'Third-Party Risk',
        description: 'Data transfer to third-party processor increases control challenges',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: 'Due diligence, processor agreements, audit rights',
      });
    }

    return risks;
  }

  /**
   * Generate transfer recommendations
   */
  private generateTransferRecommendations(
    request: TransferRequest,
    risks: TransferImpactAssessment['risks']
  ): string[] {
    const recommendations: string[] = [];

    // Base recommendations
    recommendations.push('Ensure appropriate transfer mechanism is in place');
    recommendations.push('Maintain comprehensive transfer documentation');
    recommendations.push('Implement regular monitoring and review procedures');

    // Risk-specific recommendations
    const highImpactRisks = risks.filter(r => r.impact === 'high' || r.impact === 'critical');
    if (highImpactRisks.length > 0) {
      recommendations.push('Implement additional safeguards for high-risk transfers');
      recommendations.push('Consider data localization alternatives');
      recommendations.push('Obtain explicit consent from data subjects');
    }

    // Data category recommendations
    if (request.dataCategories.some(cat => ['special_categories', 'health_data', 'biometric_data'].includes(cat))) {
      recommendations.push('Use enhanced encryption for sensitive data');
      recommendations.push('Implement strict access controls');
      recommendations.push('Consider pseudonymization techniques');
    }

    // Frequency recommendations
    if (request.transferFrequency === 'continuous') {
      recommendations.push('Implement real-time transfer monitoring');
      recommendations.push('Establish automated compliance checks');
    }

    return recommendations;
  }

  /**
   * Identify additional safeguards
   */
  private identifyAdditionalSafeguards(
    request: TransferRequest,
    risks: TransferImpactAssessment['risks']
  ): string[] {
    const safeguards: string[] = [];

    // Technical safeguards
    safeguards.push('End-to-end encryption');
    safeguards.push('Secure transfer protocols (HTTPS, SFTP)');
    safeguards.push('Data integrity verification');
    safeguards.push('Access logging and monitoring');

    // Organizational safeguards
    safeguards.push('Data processing agreements');
    safeguards.push('Audit rights for data subjects');
    safeguards.push('Staff training on international transfers');
    safeguards.push('Incident response procedures');

    // Risk-specific safeguards
    if (risks.some(r => r.category === 'Legal and Regulatory Risk')) {
      safeguards.push('Regular legal compliance reviews');
      safeguards.push('Monitoring of regulatory changes');
    }

    if (risks.some(r => r.category === 'Sensitive Data Risk')) {
      safeguards.push('Enhanced encryption standards');
      safeguards.push('Data minimization techniques');
      safeguards.push('Pseudonymization where possible');
    }

    return safeguards;
  }

  /**
   * Determine appropriate transfer mechanism
   */
  private determineTransferMechanism(
    request: TransferRequest,
    impactAssessment: TransferImpactAssessment
  ): TransferMechanism {
    // Check for adequacy decision first
    const adequacyDecision = this.adequacyDecisions.get(request.destinationCountry);
    if (adequacyDecision && adequacyDecision.status === 'adequate') {
      return this.transferMechanisms.find(m => m.type === 'adequacy_decision')!;
    }

    // Check for conditional adequacy
    if (adequacyDecision && adequacyDecision.status === 'conditional') {
      if (request.recipientType === 'internal' && adequacyDecision.conditions.includes('Commercial organizations only')) {
        return this.transferMechanisms.find(m => m.type === 'adequacy_decision')!;
      }
    }

    // Default to Standard Contractual Clauses for most cases
    if (impactAssessment.destinationCountryRisk !== 'critical') {
      return this.transferMechanisms.find(m => m.type === 'standard_contractual_clauses')!;
    }

    // For high-risk transfers, recommend multiple mechanisms
    return this.transferMechanisms.find(m => m.type === 'standard_contractual_clauses')!;
  }

  /**
   * Check consent requirement
   */
  private checkConsentRequirement(request: TransferRequest): boolean {
    // Simplified consent check
    const consentRequiredCategories = ['special_categories', 'health_data', 'biometric_data'];
    return !request.dataCategories.some(cat => consentRequiredCategories.includes(cat));
  }

  /**
   * Calculate next review date
   */
  private calculateNextReviewDate(riskLevel: string): Date {
    const now = new Date();
    let monthsToAdd = 12; // Default annual review

    switch (riskLevel) {
      case 'critical':
        monthsToAdd = 3;
        break;
      case 'high':
        monthsToAdd = 6;
        break;
      case 'medium':
        monthsToAdd = 9;
        break;
      case 'low':
        monthsToAdd = 12;
        break;
    }

    now.setMonth(now.getMonth() + monthsToAdd);
    return now;
  }

  /**
   * Notify transfer request created
   */
  private async notifyTransferRequestCreated(transferRecord: TransferRecord): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'dpo@gathera.io',
        subject: `New Cross-Border Transfer Request: ${transferRecord.transferRequest.destinationCountry}`,
        template: 'transfer-request-created',
        context: {
          transferRecord,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send transfer request notification', error);
    }
  }

  /**
   * Approve transfer request
   */
  async approveTransferRequest(id: string, approvedBy: string): Promise<TransferRecord> {
    const transferRecord = this.transferRecords.get(id);
    if (!transferRecord) {
      throw new NotFoundException('Transfer request not found');
    }

    transferRecord.status = 'approved';
    transferRecord.approvedAt = new Date();
    transferRecord.impactAssessment.approved = true;
    transferRecord.impactAssessment.approvedBy = approvedBy;
    transferRecord.impactAssessment.approvedAt = new Date();

    // Add to audit trail
    transferRecord.auditTrail.push({
      timestamp: new Date(),
      action: 'transfer_approved',
      userId: approvedBy,
      details: `Transfer request approved by ${approvedBy}`,
    });

    this.transferRecords.set(id, transferRecord);

    // Notify approval
    await this.notifyTransferApproved(transferRecord);

    this.logger.log(`Transfer request approved: ${id} by ${approvedBy}`);
    return transferRecord;
  }

  /**
   * Notify transfer approved
   */
  private async notifyTransferApproved(transferRecord: TransferRecord): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'dpo@gathera.io',
        subject: `Cross-Border Transfer Approved: ${transferRecord.transferRequest.destinationCountry}`,
        template: 'transfer-approved',
        context: {
          transferRecord,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send transfer approval notification', error);
    }
  }

  /**
   * Get transfer record by ID
   */
  async getTransferRecord(id: string): Promise<TransferRecord> {
    const transferRecord = this.transferRecords.get(id);
    if (!transferRecord) {
      throw new NotFoundException('Transfer record not found');
    }
    return transferRecord;
  }

  /**
   * Get all transfer records
   */
  getAllTransferRecords(): TransferRecord[] {
    return Array.from(this.transferRecords.values());
  }

  /**
   * Get adequacy decisions
   */
  getAdequacyDecisions(): AdequacyDecision[] {
    return Array.from(this.adequacyDecisions.values());
  }

  /**
   * Get transfer mechanisms
   */
  getTransferMechanisms(): TransferMechanism[] {
    return this.transferMechanisms;
  }

  /**
   * Get transfer statistics
   */
  getTransferStatistics(): any {
    const transfers = Array.from(this.transferRecords.values());
    
    return {
      totalTransfers: transfers.length,
      byStatus: {
        pending: transfers.filter(t => t.status === 'pending').length,
        approved: transfers.filter(t => t.status === 'approved').length,
        active: transfers.filter(t => t.status === 'active').length,
        suspended: transfers.filter(t => t.status === 'suspended').length,
        terminated: transfers.filter(t => t.status === 'terminated').length,
      },
      byDestinationCountry: this.groupByDestinationCountry(transfers),
      byMechanism: this.groupByMechanism(transfers),
      highRiskTransfers: transfers.filter(t => 
        t.impactAssessment.destinationCountryRisk === 'critical' || 
        t.impactAssessment.destinationCountryRisk === 'high'
      ).length,
      monitoringRequired: transfers.filter(t => t.monitoringRequired).length,
      upcomingReviews: transfers.filter(t => 
        t.nextReviewDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      ).length,
    };
  }

  /**
   * Group transfers by destination country
   */
  private groupByDestinationCountry(transfers: TransferRecord[]): Record<string, number> {
    return transfers.reduce((grouped, transfer) => {
      const country = transfer.transferRequest.destinationCountry;
      grouped[country] = (grouped[country] || 0) + 1;
      return grouped;
    }, {} as Record<string, number>);
  }

  /**
   * Group transfers by mechanism
   */
  private groupByMechanism(transfers: TransferRecord[]): Record<string, number> {
    return transfers.reduce((grouped, transfer) => {
      const mechanism = transfer.mechanism.name;
      grouped[mechanism] = (grouped[mechanism] || 0) + 1;
      return grouped;
    }, {} as Record<string, number>);
  }

  /**
   * Update adequacy decision
   */
  async updateAdequacyDecision(country: string, decision: Partial<AdequacyDecision>): Promise<AdequacyDecision> {
    const existing = this.adequacyDecisions.get(country);
    if (!existing) {
      throw new NotFoundException('Adequacy decision not found for country');
    }

    const updated = { ...existing, ...decision, lastUpdated: new Date() };
    this.adequacyDecisions.set(country, updated);

    // Review affected transfers
    await this.reviewAffectedTransfers(country);

    this.logger.log(`Adequacy decision updated for ${country}`);
    return updated;
  }

  /**
   * Review transfers affected by adequacy decision changes
   */
  private async reviewAffectedTransfers(country: string): Promise<void> {
    const affectedTransfers = Array.from(this.transferRecords.values())
      .filter(transfer => transfer.transferRequest.destinationCountry === country);

    for (const transfer of affectedTransfers) {
      // Re-assess transfer mechanism and risks
      const newImpactAssessment = await this.performTransferImpactAssessment(transfer.transferRequest);
      const newMechanism = this.determineTransferMechanism(transfer.transferRequest, newImpactAssessment);

      transfer.impactAssessment = newImpactAssessment;
      transfer.mechanism = newMechanism;
      transfer.complianceChecks.adequacyDecision = newMechanism.type === 'adequacy_decision';

      // Add to audit trail
      transfer.auditTrail.push({
        timestamp: new Date(),
        action: 'adequacy_decision_review',
        userId: 'system',
        details: `Transfer reviewed due to adequacy decision change for ${country}`,
      });

      this.transferRecords.set(transfer.id, transfer);
    }

    // Notify about affected transfers
    if (affectedTransfers.length > 0) {
      await this.notifyAdequacyDecisionChange(country, affectedTransfers);
    }
  }

  /**
   * Notify about adequacy decision changes
   */
  private async notifyAdequacyDecisionChange(country: string, affectedTransfers: TransferRecord[]): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: 'dpo@gathera.io',
        subject: `Adequacy Decision Change: ${country}`,
        template: 'adequacy-decision-change',
        context: {
          country,
          affectedTransfers: affectedTransfers.length,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send adequacy decision change notification', error);
    }
  }
}
