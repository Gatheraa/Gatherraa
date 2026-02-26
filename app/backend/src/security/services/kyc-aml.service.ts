import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import {
  KycVerification,
  KycDocument,
  AmlAlert,
  KycStatus,
  KycLevel,
  KycDocumentType,
  AmlRiskLevel,
  AmlCheckType,
} from '../entities/kyc.entity';
import { User } from '../../users/entities/user.entity';
import { SecurityAuditService } from './security-audit.service';
import { EmailService } from '../../email/email.service';

export interface KycSubmissionData {
  personalInfo: any;
  businessInfo?: any;
  documents: Array<{
    type: KycDocumentType;
    file: Buffer;
    fileName: string;
    mimeType: string;
  }>;
  metadata?: any;
}

export interface KycVerificationResult {
  verificationId: string;
  status: KycStatus;
  level: KycLevel;
  riskLevel: AmlRiskLevel;
  nextSteps?: string[];
  documentsRequired?: KycDocumentType[];
}

export interface AmlCheckResult {
  riskLevel: AmlRiskLevel;
  alerts: AmlAlert[];
  recommendations: string[];
  monitoringRequired: boolean;
  nextReviewDate: Date;
}

@Injectable()
export class KycAmlService {
  constructor(
    @InjectRepository(KycVerification)
    private readonly kycVerificationRepository: Repository<KycVerification>,
    @InjectRepository(KycDocument)
    private readonly kycDocumentRepository: Repository<KycDocument>,
    @InjectRepository(AmlAlert)
    private readonly amlAlertRepository: Repository<AmlAlert>,
    private readonly configService: ConfigService,
    private readonly auditService: SecurityAuditService,
    private readonly emailService: EmailService,
  ) {}

  async submitKycVerification(
    userId: string,
    data: KycSubmissionData
  ): Promise<KycVerificationResult> {
    // Check if user already has pending verification
    const existingVerification = await this.kycVerificationRepository.findOne({
      where: { 
        userId, 
        status: In([KycStatus.PENDING, KycStatus.IN_REVIEW]) 
      },
    });

    if (existingVerification) {
      throw new BadRequestException('KYC verification already in progress');
    }

    // Create verification record
    const verification = this.kycVerificationRepository.create({
      userId,
      status: KycStatus.PENDING,
      level: KycLevel.LEVEL_0,
      personalInfo: data.personalInfo,
      businessInfo: data.businessInfo,
      metadata: data.metadata,
    });

    const savedVerification = await this.kycVerificationRepository.save(verification);

    // Process documents
    const processedDocuments = [];
    for (const doc of data.documents) {
      const document = await this.processKycDocument(
        savedVerification.id,
        doc.type,
        doc.file,
        doc.fileName,
        doc.mimeType
      );
      processedDocuments.push(document);
    }

    // Update verification with documents
    savedVerification.verificationData = {
      documents: processedDocuments.map(doc => ({
        type: doc.type,
        url: doc.fileUrl,
        hash: doc.fileHash,
        uploadedAt: doc.createdAt,
        status: 'pending',
      })),
    };

    await this.kycVerificationRepository.save(savedVerification);

    // Perform initial AML checks
    const amlResult = await this.performAmlChecks(userId, savedVerification.id);
    
    // Update verification with AML data
    savedVerification.amlData = amlResult;
    await this.kycVerificationRepository.save(savedVerification);

    // Determine initial risk level and requirements
    const riskLevel = this.calculateRiskLevel(savedVerification, amlResult);
    const requiredLevel = this.determineRequiredKycLevel(data.personalInfo, data.businessInfo);

    // Log audit event
    await this.auditService.logEvent({
      userId,
      action: 'KYC_SUBMITTED',
      resource: 'kyc_verification',
      resourceId: savedVerification.id,
      details: {
        level: requiredLevel,
        riskLevel,
        documentCount: processedDocuments.length,
      },
    });

    // Send confirmation email
    await this.emailService.sendKycSubmissionConfirmation(
      data.personalInfo.email,
      savedVerification.id
    );

    return {
      verificationId: savedVerification.id,
      status: savedVerification.status,
      level: savedVerification.level,
      riskLevel,
      nextSteps: this.getNextSteps(requiredLevel, riskLevel),
      documentsRequired: this.getRequiredDocuments(requiredLevel, processedDocuments),
    };
  }

  async reviewKycVerification(
    verificationId: string,
    reviewerId: string,
    decision: 'approve' | 'reject' | 'request_more_info',
    notes?: string,
    approvedLevel?: KycLevel,
    conditions?: string[]
  ): Promise<KycVerification> {
    const verification = await this.kycVerificationRepository.findOne({
      where: { id: verificationId },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    if (verification.status !== KycStatus.IN_REVIEW) {
      throw new BadRequestException('Verification is not in review status');
    }

    const previousStatus = verification.status;
    
    // Update status based on decision
    switch (decision) {
      case 'approve':
        verification.status = KycStatus.APPROVED;
        verification.level = approvedLevel || KycLevel.LEVEL_1;
        verification.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        break;
      case 'reject':
        verification.status = KycStatus.REJECTED;
        break;
      case 'request_more_info':
        verification.status = KycStatus.PENDING;
        break;
    }

    verification.reviewData = {
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      notes,
      approvedLevel: approvedLevel,
      conditions,
      monitoringRequired: verification.amlData?.riskLevel !== AmlRiskLevel.LOW,
      reviewFrequency: this.getReviewFrequency(verification.amlData?.riskLevel),
    };

    verification.lastReviewedAt = new Date();
    verification.nextReviewAt = this.calculateNextReviewDate(verification);

    await this.kycVerificationRepository.save(verification);

    // Log audit event
    await this.auditService.logEvent({
      userId: reviewerId,
      action: 'KYC_REVIEWED',
      resource: 'kyc_verification',
      resourceId: verificationId,
      details: {
        decision,
        previousStatus,
        newStatus: verification.status,
        level: verification.level,
        riskLevel: verification.amlData?.riskLevel,
      },
    });

    // Send notification to user
    await this.notifyUserOfReviewResult(verification.user.email, decision, notes);

    return verification;
  }

  async performAmlChecks(
    userId: string,
    verificationId: string
  ): Promise<any> {
    const verification = await this.kycVerificationRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    const checks = [];
    const riskFactors = [];
    let totalRiskScore = 0;

    // Sanction list check
    const sanctionResult = await this.checkSanctionLists(verification.personalInfo);
    checks.push(sanctionResult);
    if (sanctionResult.status === 'failed') {
      riskFactors.push({
        type: 'sanction_list_match',
        severity: 'high',
        description: 'Match found on sanction lists',
      });
      totalRiskScore += 50;
    }

    // PEP (Politically Exposed Person) check
    const pepResult = await this.checkPepLists(verification.personalInfo);
    checks.push(pepResult);
    if (pepResult.status === 'failed') {
      riskFactors.push({
        type: 'pep_list_match',
        severity: 'medium',
        description: 'Match found on PEP lists',
      });
      totalRiskScore += 30;
    }

    // Adverse media check
    const mediaResult = await this.checkAdverseMedia(verification.personalInfo);
    checks.push(mediaResult);
    if (mediaResult.status === 'failed') {
      riskFactors.push({
        type: 'adverse_media',
        severity: 'medium',
        description: 'Negative news found',
      });
      totalRiskScore += 25;
    }

    // Watch list check
    const watchResult = await this.checkWatchLists(verification.personalInfo);
    checks.push(watchResult);
    if (watchResult.status === 'failed') {
      riskFactors.push({
        type: 'watch_list_match',
        severity: 'low',
        description: 'Match found on watch lists',
      });
      totalRiskScore += 15;
    }

    // Calculate risk level
    const riskLevel = this.calculateAmlRiskLevel(totalRiskScore);

    // Create alerts for failed checks
    for (const check of checks) {
      if (check.status === 'failed') {
        await this.createAmlAlert(userId, check, riskLevel);
      }
    }

    return {
      riskLevel,
      checks,
      riskFactors,
      recommendations: this.getAmlRecommendations(riskLevel, riskFactors),
      lastChecked: new Date(),
      nextReviewDate: this.calculateNextAmlReviewDate(riskLevel),
    };
  }

  async getKycStatus(userId: string): Promise<KycVerification | null> {
    return this.kycVerificationRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingVerifications(): Promise<KycVerification[]> {
    return this.kycVerificationRepository.find({
      where: { 
        status: In([KycStatus.PENDING, KycStatus.IN_REVIEW]) 
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getAmlAlerts(
    riskLevel?: AmlRiskLevel,
    status?: string
  ): Promise<AmlAlert[]> {
    const where: any = {};
    if (riskLevel) where.riskLevel = riskLevel;
    if (status) where.status = status;

    return this.amlAlertRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateAmlAlert(
    alertId: string,
    updates: {
      status?: string;
      investigation?: any;
    },
    updatedBy: string
  ): Promise<AmlAlert> {
    const alert = await this.amlAlertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException('AML alert not found');
    }

    if (updates.status) {
      alert.status = updates.status;
    }

    if (updates.investigation) {
      alert.investigation = {
        ...alert.investigation,
        ...updates.investigation,
      };
    }

    if (updates.status === 'resolved') {
      alert.resolvedAt = new Date();
      if (alert.investigation) {
        alert.investigation.resolvedBy = updatedBy;
        alert.investigation.resolvedAt = new Date();
      }
    }

    const savedAlert = await this.amlAlertRepository.save(alert);

    // Log audit event
    await this.auditService.logEvent({
      userId: updatedBy,
      action: 'AML_ALERT_UPDATED',
      resource: 'aml_alert',
      resourceId: alertId,
      details: updates,
    });

    return savedAlert;
  }

  private async processKycDocument(
    verificationId: string,
    type: KycDocumentType,
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<KycDocument> {
    // Generate file hash
    const fileHash = createHash('sha256').update(file).digest('hex');

    // Store file (in production, use cloud storage)
    const fileUrl = await this.storeDocument(file, fileName, fileHash);

    // Extract metadata
    const fileMetadata = {
      size: file.length,
      mimeType,
      extractedText: await this.extractTextFromDocument(file, mimeType),
    };

    // Perform OCR and document verification
    const extractedData = await this.extractDocumentData(file, type);
    const verificationResults = await this.verifyDocumentAuthenticity(file, type);

    const document = this.kycDocumentRepository.create({
      verificationId,
      type,
      fileName,
      fileUrl,
      fileHash,
      fileMetadata,
      extractedData,
      verificationResults,
      status: verificationResults.authenticityScore > 0.7 ? 'verified' : 'needs_review',
    });

    return this.kycDocumentRepository.save(document);
  }

  private async storeDocument(file: Buffer, fileName: string, hash: string): Promise<string> {
    // In production, upload to cloud storage (S3, GCS, etc.)
    const uploadsDir = './uploads/kyc';
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = `${uploadsDir}/${hash}_${fileName}`;
    await fs.writeFile(filePath, file);
    
    return `/uploads/kyc/${hash}_${fileName}`;
  }

  private async extractTextFromDocument(file: Buffer, mimeType: string): Promise<string> {
    // In production, use OCR service like Tesseract or cloud vision
    return 'Extracted text placeholder';
  }

  private async extractDocumentData(file: Buffer, type: KycDocumentType): Promise<any> {
    // In production, use document parsing service
    return {
      documentNumber: 'DOC123456',
      issuingCountry: 'US',
      expiryDate: new Date('2028-12-31'),
      fullName: 'John Doe',
    };
  }

  private async verifyDocumentAuthenticity(file: Buffer, type: KycDocumentType): Promise<any> {
    // In production, use document verification service
    return {
      authenticityScore: 0.85,
      tamperingDetected: false,
      forgeryIndicators: [],
      qualityScore: 0.9,
      ocrConfidence: 0.88,
    };
  }

  private async checkSanctionLists(personalInfo: any): Promise<any> {
    // In production, integrate with sanction list providers (ComplyAdvantage, etc.)
    return {
      type: AmlCheckType.SANCTION_LIST,
      status: 'passed',
      details: { checkedAt: new Date() },
      checkedAt: new Date(),
    };
  }

  private async checkPepLists(personalInfo: any): Promise<any> {
    // In production, integrate with PEP list providers
    return {
      type: AmlCheckType.PEP_LIST,
      status: 'passed',
      details: { checkedAt: new Date() },
      checkedAt: new Date(),
    };
  }

  private async checkAdverseMedia(personalInfo: any): Promise<any> {
    // In production, integrate with media monitoring services
    return {
      type: AmlCheckType.ADVERSE_MEDIA,
      status: 'passed',
      details: { checkedAt: new Date() },
      checkedAt: new Date(),
    };
  }

  private async checkWatchLists(personalInfo: any): Promise<any> {
    // In production, integrate with watch list providers
    return {
      type: AmlCheckType.WATCH_LIST,
      status: 'passed',
      details: { checkedAt: new Date() },
      checkedAt: new Date(),
    };
  }

  private async createAmlAlert(
    userId: string,
    checkResult: any,
    riskLevel: AmlRiskLevel
  ): Promise<AmlAlert> {
    const alert = this.amlAlertRepository.create({
      userId,
      riskLevel,
      checkType: checkResult.type,
      alertType: `${checkResult.type}_match`,
      description: `AML check failed: ${checkResult.type}`,
      alertData: {
        riskFactors: [{ type: checkResult.type, weight: 50, description: 'Check failed' }],
        totalRiskScore: 50,
      },
      status: 'new',
    });

    return this.amlAlertRepository.save(alert);
  }

  private calculateRiskLevel(verification: KycVerification, amlData: any): AmlRiskLevel {
    let riskScore = 0;

    // Document quality
    const docScores = verification.verificationData?.documents?.map((d: any) => 
      d.verificationResults?.authenticityScore || 0
    ) || [];
    const avgDocScore = docScores.length > 0 ? docScores.reduce((a: number, b: number) => a + b) / docScores.length : 0;
    
    if (avgDocScore < 0.7) riskScore += 20;

    // AML checks
    if (amlData?.riskLevel) {
      switch (amlData.riskLevel) {
        case AmlRiskLevel.CRITICAL: riskScore += 80; break;
        case AmlRiskLevel.HIGH: riskScore += 60; break;
        case AmlRiskLevel.MEDIUM: riskScore += 40; break;
        case AmlRiskLevel.LOW: riskScore += 10; break;
      }
    }

    // Business vs Individual
    if (verification.businessInfo) {
      riskScore += 15; // Business accounts have higher risk
    }

    if (riskScore >= 70) return AmlRiskLevel.CRITICAL;
    if (riskScore >= 50) return AmlRiskLevel.HIGH;
    if (riskScore >= 30) return AmlRiskLevel.MEDIUM;
    return AmlRiskLevel.LOW;
  }

  private calculateAmlRiskLevel(score: number): AmlRiskLevel {
    if (score >= 70) return AmlRiskLevel.CRITICAL;
    if (score >= 50) return AmlRiskLevel.HIGH;
    if (score >= 30) return AmlRiskLevel.MEDIUM;
    return AmlRiskLevel.LOW;
  }

  private determineRequiredKycLevel(personalInfo: any, businessInfo?: any): KycLevel {
    if (businessInfo) return KycLevel.LEVEL_3;
    
    const annualIncome = personalInfo.annualIncome;
    if (annualIncome && parseInt(annualIncome) > 100000) return KycLevel.LEVEL_2;
    
    return KycLevel.LEVEL_1;
  }

  private getNextSteps(requiredLevel: KycLevel, riskLevel: AmlRiskLevel): string[] {
    const steps = ['Document verification in progress'];
    
    if (riskLevel !== AmlRiskLevel.LOW) {
      steps.push('Additional AML screening required');
    }
    
    if (requiredLevel >= KycLevel.LEVEL_2) {
      steps.push('Enhanced verification required');
    }
    
    return steps;
  }

  private getRequiredDocuments(level: KycLevel, existingDocs: any[]): KycDocumentType[] {
    const required = [KycDocumentType.PASSPORT, KycDocumentType.SELFIE];
    
    if (level >= KycLevel.LEVEL_2) {
      required.push(KycDocumentType.PROOF_OF_ADDRESS);
    }
    
    if (level >= KycLevel.LEVEL_3) {
      required.push(KycDocumentType.BUSINESS_REGISTRATION, KycDocumentType.TAX_ID);
    }
    
    const existingTypes = existingDocs.map(doc => doc.type);
    return required.filter(type => !existingTypes.includes(type));
  }

  private getAmlRecommendations(riskLevel: AmlRiskLevel, riskFactors: any[]): string[] {
    const recommendations = [];
    
    if (riskLevel === AmlRiskLevel.HIGH || riskLevel === AmlRiskLevel.CRITICAL) {
      recommendations.push('Enhanced monitoring required');
      recommendations.push('Manual review recommended');
    }
    
    if (riskFactors.some((rf: any) => rf.type === 'pep_list_match')) {
      recommendations.push('Source of funds verification required');
    }
    
    if (riskFactors.some((rf: any) => rf.type === 'adverse_media')) {
      recommendations.push('Reputation assessment recommended');
    }
    
    return recommendations;
  }

  private getReviewFrequency(riskLevel?: AmlRiskLevel): number {
    switch (riskLevel) {
      case AmlRiskLevel.CRITICAL: return 30; // days
      case AmlRiskLevel.HIGH: return 90;
      case AmlRiskLevel.MEDIUM: return 180;
      case AmlRiskLevel.LOW: return 365;
      default: return 365;
    }
  }

  private calculateNextReviewDate(verification: KycVerification): Date {
    const frequency = this.getReviewFrequency(verification.amlData?.riskLevel);
    return new Date(Date.now() + frequency * 24 * 60 * 60 * 1000);
  }

  private calculateNextAmlReviewDate(riskLevel: AmlRiskLevel): Date {
    const frequency = this.getReviewFrequency(riskLevel);
    return new Date(Date.now() + frequency * 24 * 60 * 60 * 1000);
  }

  private async notifyUserOfReviewResult(
    email: string,
    decision: string,
    notes?: string
  ): Promise<void> {
    // Send email notification
    await this.emailService.sendKycReviewResult(email, decision, notes);
  }
}
