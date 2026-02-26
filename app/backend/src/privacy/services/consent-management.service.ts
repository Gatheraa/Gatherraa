import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { PrivacyConsent } from '../entities/privacy-consent.entity';
import { PrivacyPolicy } from '../entities/privacy-policy.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { randomBytes } from 'crypto';

export interface ConsentRequest {
  userId: string;
  privacyPolicyId: string;
  consentDetails: {
    marketing: boolean;
    analytics: boolean;
    personalization: boolean;
    thirdPartySharing: boolean;
    cookies: boolean;
    emailCommunications: boolean;
    smsCommunications: boolean;
    locationTracking: boolean;
    biometricData: boolean;
    financialData: boolean;
  };
  ipAddress?: string;
  userAgent?: string;
  consentLanguage?: string;
}

export interface ConsentUpdate {
  consentDetails: Partial<ConsentRequest['consentDetails']>;
  withdrawalReason?: string;
}

export interface DataSubjectRequest {
  type: 'access' | 'deletion' | 'rectification' | 'portability' | 'objection';
  userId: string;
  details?: string;
  verificationData?: Record<string, any>;
}

export interface ConsentMetrics {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  consentByCategory: Record<string, number>;
  consentTrends: Array<{
    date: string;
    granted: number;
    withdrawn: number;
  }>;
  averageConsentRate: number;
}

@Injectable()
export class ConsentManagementService {
  private readonly logger = new Logger(ConsentManagementService.name);

  constructor(
    @InjectRepository(PrivacyConsent)
    private consentRepository: Repository<PrivacyConsent>,
    @InjectRepository(PrivacyPolicy)
    private policyRepository: Repository<PrivacyPolicy>,
    private mailerService: MailerService,
  ) {}

  /**
   * Create or update user consent
   */
  async createConsent(request: ConsentRequest): Promise<PrivacyConsent> {
    // Validate privacy policy
    const policy = await this.policyRepository.findOne({
      where: { id: request.privacyPolicyId, status: 'active' }
    });

    if (!policy) {
      throw new NotFoundException('Active privacy policy not found');
    }

    // Check if consent already exists for this user and policy
    let consent = await this.consentRepository.findOne({
      where: {
        userId: request.userId,
        privacyPolicyId: request.privacyPolicyId,
      }
    });

    if (consent) {
      // Update existing consent
      consent.consentDetails = { ...consent.consentDetails, ...request.consentDetails };
      consent.status = 'granted';
      consent.withdrawnAt = null;
      consent.withdrawalReason = null;
      consent.lastReviewedAt = new Date();
      consent.ipAddress = request.ipAddress;
      consent.userAgent = request.userAgent;
      consent.consentLanguage = request.consentLanguage;
    } else {
      // Create new consent
      consent = this.consentRepository.create({
        ...request,
        status: 'granted',
        lastReviewedAt: new Date(),
      });
    }

    const savedConsent = await this.consentRepository.save(consent);

    // Send confirmation email
    await this.sendConsentConfirmation(savedConsent, policy);

    this.logger.log(`Consent created/updated for user ${request.userId}`);
    return savedConsent;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(userId: string, privacyPolicyId: string, reason?: string): Promise<PrivacyConsent> {
    const consent = await this.consentRepository.findOne({
      where: {
        userId,
        privacyPolicyId,
        status: 'granted',
      }
    });

    if (!consent) {
      throw new NotFoundException('Active consent not found');
    }

    consent.status = 'withdrawn';
    consent.withdrawnAt = new Date();
    consent.withdrawalReason = reason;

    const savedConsent = await this.consentRepository.save(consent);

    // Send withdrawal confirmation
    const policy = await this.policyRepository.findOne({
      where: { id: privacyPolicyId }
    });

    if (policy) {
      await this.sendWithdrawalConfirmation(savedConsent, policy);
    }

    this.logger.log(`Consent withdrawn for user ${userId}, policy ${privacyPolicyId}`);
    return savedConsent;
  }

  /**
   * Get user consents
   */
  async getUserConsents(userId: string): Promise<PrivacyConsent[]> {
    return this.consentRepository.find({
      where: { userId },
      relations: ['privacyPolicy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if user has given consent for specific category
   */
  async hasConsent(userId: string, category: keyof ConsentRequest['consentDetails']): Promise<boolean> {
    const consent = await this.consentRepository.findOne({
      where: {
        userId,
        status: 'granted',
      },
      relations: ['privacyPolicy'],
      order: { createdAt: 'DESC' },
    });

    if (!consent || !consent.consentDetails[category]) {
      return false;
    }

    // Check if the policy is still active
    return consent.privacyPolicy.status === 'active';
  }

  /**
   * Handle data subject rights request
   */
  async handleDataSubjectRequest(request: DataSubjectRequest): Promise<any> {
    // Verify user identity (simplified for demo)
    const isVerified = await this.verifyUserIdentity(request.userId, request.verificationData);
    if (!isVerified) {
      throw new BadRequestException('Identity verification failed');
    }

    switch (request.type) {
      case 'access':
        return this.handleAccessRequest(request.userId);
      
      case 'deletion':
        return this.handleDeletionRequest(request.userId);
      
      case 'rectification':
        return this.handleRectificationRequest(request.userId, request.details);
      
      case 'portability':
        return this.handlePortabilityRequest(request.userId);
      
      case 'objection':
        return this.handleObjectionRequest(request.userId, request.details);
      
      default:
        throw new BadRequestException('Invalid request type');
    }
  }

  /**
   * Handle right to access request
   */
  private async handleAccessRequest(userId: string): Promise<any> {
    const consents = await this.getUserConsents(userId);
    
    return {
      requestType: 'access',
      userId,
      data: {
        consents: consents.map(c => ({
          policyName: c.privacyPolicy.name,
          policyVersion: c.privacyPolicy.version,
          consentDetails: c.consentDetails,
          grantedAt: c.createdAt,
          status: c.status,
          withdrawnAt: c.withdrawnAt,
        })),
        exportTimestamp: new Date(),
      },
    };
  }

  /**
   * Handle right to deletion request
   */
  private async handleDeletionRequest(userId: string): Promise<any> {
    // Withdraw all consents
    await this.consentRepository.update(
      { userId, status: 'granted' },
      { 
        status: 'withdrawn',
        withdrawnAt: new Date(),
        withdrawalReason: 'Right to deletion request',
      }
    );

    // In a real implementation, this would also trigger data deletion/anonymization
    // across all systems where the user's data is stored

    return {
      requestType: 'deletion',
      userId,
      action: 'All consents withdrawn and data deletion initiated',
      processedAt: new Date(),
    };
  }

  /**
   * Handle right to rectification request
   */
  private async handleRectificationRequest(userId: string, details?: string): Promise<any> {
    // In a real implementation, this would provide a mechanism for users to correct their data
    return {
      requestType: 'rectification',
      userId,
      message: 'Rectification request received. Please contact support to proceed with data correction.',
      details,
      processedAt: new Date(),
    };
  }

  /**
   * Handle right to data portability request
   */
  private async handlePortabilityRequest(userId: string): Promise<any> {
    const consents = await this.getUserConsents(userId);
    
    return {
      requestType: 'portability',
      userId,
      data: {
        format: 'JSON',
        consents: consents.map(c => ({
          policyName: c.privacyPolicy.name,
          policyVersion: c.privacyPolicy.version,
          consentDetails: c.consentDetails,
          grantedAt: c.createdAt,
          status: c.status,
        })),
        exportTimestamp: new Date(),
      },
    };
  }

  /**
   * Handle right to objection request
   */
  private async handleObjectionRequest(userId: string, details?: string): Promise<any> {
    // Withdraw marketing and analytics consents
    const marketingConsents = await this.consentRepository.find({
      where: { userId, status: 'granted' },
    });

    for (const consent of marketingConsents) {
      consent.consentDetails.marketing = false;
      consent.consentDetails.analytics = false;
      consent.consentDetails.personalization = false;
      consent.consentDetails.thirdPartySharing = false;
      await this.consentRepository.save(consent);
    }

    return {
      requestType: 'objection',
      userId,
      action: 'Marketing and analytics processing stopped',
      details,
      processedAt: new Date(),
    };
  }

  /**
   * Verify user identity (simplified)
   */
  private async verifyUserIdentity(userId: string, verificationData?: Record<string, any>): Promise<boolean> {
    // In a real implementation, this would involve multi-factor authentication
    // For demo purposes, we'll assume verification is successful if data is provided
    return !!verificationData;
  }

  /**
   * Get consent metrics
   */
  async getConsentMetrics(days: number = 30): Promise<ConsentMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalConsents,
      activeConsents,
      withdrawnConsents,
      consentTrends,
    ] = await Promise.all([
      this.consentRepository.count({ where: { createdAt: MoreThanOrEqual(startDate) } }),
      this.consentRepository.count({ where: { status: 'granted' } }),
      this.consentRepository.count({ where: { status: 'withdrawn' } }),
      this.getConsentTrends(days),
    ]);

    const consentByCategory = await this.getConsentByCategory();

    const averageConsentRate = totalConsents > 0 
      ? Math.round((activeConsents / totalConsents) * 100) 
      : 0;

    return {
      totalConsents,
      activeConsents,
      withdrawnConsents,
      consentByCategory,
      consentTrends,
      averageConsentRate,
    };
  }

  /**
   * Get consent trends over time
   */
  private async getConsentTrends(days: number): Promise<Array<{ date: string; granted: number; withdrawn: number }>> {
    const trends = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [granted, withdrawn] = await Promise.all([
        this.consentRepository.count({
          where: {
            status: 'granted',
            createdAt: Between(date, nextDate),
          }
        }),
        this.consentRepository.count({
          where: {
            status: 'withdrawn',
            withdrawnAt: Between(date, nextDate),
          }
        }),
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        granted,
        withdrawn,
      });
    }

    return trends;
  }

  /**
   * Get consent breakdown by category
   */
  private async getConsentByCategory(): Promise<Record<string, number>> {
    const activeConsents = await this.consentRepository.find({
      where: { status: 'granted' },
    });

    const categories = [
      'marketing',
      'analytics',
      'personalization',
      'thirdPartySharing',
      'cookies',
      'emailCommunications',
      'smsCommunications',
      'locationTracking',
      'biometricData',
      'financialData',
    ];

    const counts: Record<string, number> = {};
    
    for (const category of categories) {
      counts[category] = activeConsents.filter(
        consent => consent.consentDetails[category as keyof typeof consent.consentDetails]
      ).length;
    }

    return counts;
  }

  /**
   * Send consent confirmation email
   */
  private async sendConsentConfirmation(consent: PrivacyConsent, policy: PrivacyPolicy): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: consent.userId, // In reality, this would be the user's email
        subject: 'Consent Confirmation',
        template: 'consent-confirmation',
        context: {
          userName: consent.userId,
          policyName: policy.name,
          policyVersion: policy.version,
          consentDetails: consent.consentDetails,
          grantedAt: consent.createdAt,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send consent confirmation', error);
    }
  }

  /**
   * Send withdrawal confirmation email
   */
  private async sendWithdrawalConfirmation(consent: PrivacyConsent, policy: PrivacyPolicy): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: consent.userId, // In reality, this would be the user's email
        subject: 'Consent Withdrawal Confirmation',
        template: 'consent-withdrawal',
        context: {
          userName: consent.userId,
          policyName: policy.name,
          policyVersion: policy.version,
          withdrawnAt: consent.withdrawnAt,
          reason: consent.withdrawalReason,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send withdrawal confirmation', error);
    }
  }

  /**
   * Generate consent report for compliance
   */
  async generateConsentReport(startDate: Date, endDate: Date): Promise<any> {
    const consents = await this.consentRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['privacyPolicy'],
    });

    const metrics = await this.getConsentMetrics();

    return {
      reportPeriod: {
        startDate,
        endDate,
      },
      summary: {
        totalConsents: consents.length,
        uniqueUsers: new Set(consents.map(c => c.userId)).size,
        policiesInvolved: new Set(consents.map(c => c.privacyPolicyId)).size,
      },
      breakdown: {
        byStatus: {
          granted: consents.filter(c => c.status === 'granted').length,
          withdrawn: consents.filter(c => c.status === 'withdrawn').length,
        },
        byCategory: metrics.consentByCategory,
        trends: metrics.consentTrends,
      },
      compliance: {
        averageConsentRate: metrics.averageConsentRate,
        withdrawalRate: metrics.totalConsents > 0 
          ? Math.round((metrics.withdrawnConsents / metrics.totalConsents) * 100)
          : 0,
      },
      generatedAt: new Date(),
    };
  }
}
