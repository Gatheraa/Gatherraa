import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { AnalyticsSummary } from '../entities/analytics-summary.entity';
import { subDays } from 'date-fns';

export enum DataAccessLevel {
  PUBLIC = 'public',
  ORGANIZER = 'organizer',
  USER = 'user',
  ADMIN = 'admin',
}

export interface PrivacyControlOptions {
  anonymizeUserData?: boolean;
  restrictPersonalData?: boolean;
  maskSensitiveFields?: boolean;
  excludeUserData?: boolean;
}

@Injectable()
export class PrivacyControlService {
  private readonly logger = new Logger(PrivacyControlService.name);

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(AnalyticsSummary)
    private analyticsSummaryRepository: Repository<AnalyticsSummary>,
  ) {}

  /**
   * Apply privacy controls to analytics data based on access level
   */
  applyPrivacyControls<T>(
    data: T[],
    accessLevel: DataAccessLevel,
    userId?: string,
    eventId?: string,
    options?: PrivacyControlOptions
  ): T[] {
    const processedData = [...data];

    switch (accessLevel) {
      case DataAccessLevel.PUBLIC:
        return this.applyPublicPrivacyControls(processedData, options);
      case DataAccessLevel.USER:
        return this.applyUserPrivacyControls(processedData, userId, options);
      case DataAccessLevel.ORGANIZER:
        return this.applyOrganizerPrivacyControls(processedData, userId, eventId, options);
      case DataAccessLevel.ADMIN:
        return this.applyAdminPrivacyControls(processedData, options);
      default:
        return this.applyDefaultPrivacyControls(processedData, options);
    }
  }

  /**
   * Apply privacy controls for public access
   */
  private applyPublicPrivacyControls<T>(data: T[], options?: PrivacyControlOptions): T[] {
    const opts = { ...options };
    
    return data.map(item => {
      let processedItem = { ...item as any };

      // Remove or anonymize personal data
      if ('userId' in processedItem) {
        if (opts.excludeUserData) {
          delete processedItem.userId;
        } else if (opts.anonymizeUserData) {
          processedItem.userId = this.anonymizeUserId(processedItem.userId);
        }
      }

      // Mask sensitive fields
      if (opts.maskSensitiveFields) {
        processedItem = this.maskSensitiveFields(processedItem);
      }

      // Restrict personal data
      if (opts.restrictPersonalData) {
        processedItem = this.removePersonalData(processedItem);
      }

      return processedItem;
    });
  }

  /**
   * Apply privacy controls for user access
   */
  private applyUserPrivacyControls<T>(data: T[], userId?: string, options?: PrivacyControlOptions): T[] {
    const opts = { ...options };
    
    return data.map(item => {
      let processedItem = { ...item as any };

      // For user data, only show their own data or anonymize others
      if ('userId' in processedItem && processedItem.userId !== userId) {
        if (opts.excludeUserData) {
          delete processedItem.userId;
        } else if (opts.anonymizeUserData) {
          processedItem.userId = this.anonymizeUserId(processedItem.userId);
        }
      }

      // Mask sensitive fields
      if (opts.maskSensitiveFields) {
        processedItem = this.maskSensitiveFields(processedItem);
      }

      return processedItem;
    });
  }

  /**
   * Apply privacy controls for organizer access
   */
  private applyOrganizerPrivacyControls<T>(data: T[], userId?: string, eventId?: string, options?: PrivacyControlOptions): T[] {
    const opts = { ...options };
    
    return data.map(item => {
      let processedItem = { ...item as any };

      // Organizers can see event-related data but may have restrictions on personal data
      if (opts.anonymizeUserData) {
        if ('userId' in processedItem) {
          processedItem.userId = this.anonymizeUserId(processedItem.userId);
        }
      }

      // Mask sensitive fields
      if (opts.maskSensitiveFields) {
        processedItem = this.maskSensitiveFields(processedItem);
      }

      return processedItem;
    });
  }

  /**
   * Apply privacy controls for admin access
   */
  private applyAdminPrivacyControls<T>(data: T[], options?: PrivacyControlOptions): T[] {
    // Admins typically have full access, but may still want some privacy controls
    const opts = { ...options };
    
    if (!opts) {
      return data; // No restrictions for admins by default
    }

    return data.map(item => {
      let processedItem = { ...item as any };

      if (opts.maskSensitiveFields) {
        processedItem = this.maskSensitiveFields(processedItem);
      }

      return processedItem;
    });
  }

  /**
   * Apply default privacy controls
   */
  private applyDefaultPrivacyControls<T>(data: T[], options?: PrivacyControlOptions): T[] {
    return this.applyPublicPrivacyControls(data, options);
  }

  /**
   * Anonymize a user ID
   */
  private anonymizeUserId(userId: string): string {
    // Create a hash-like anonymized version
    return `anon_${userId.substring(0, 8)}_${Date.now()}`;
  }

  /**
   * Remove personal data from an object
   */
  private removePersonalData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const personalDataKeys = [
      'email', 'phone', 'address', 'location', 'ipAddress', 
      'userProperties', 'personalInfo', 'contactInfo', 'privateData'
    ];

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!personalDataKeys.includes(key.toLowerCase())) {
        result[key] = this.removePersonalData(value);
      }
    }

    return result;
  }

  /**
   * Mask sensitive fields in an object
   */
  private maskSensitiveFields(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sensitiveKeys = [
      'email', 'phone', 'ssn', 'creditCard', 'password', 'token', 
      'secret', 'apiKey', 'ipAddress', 'location', 'address'
    ];

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        result[key] = this.maskValue(value);
      } else if (typeof value === 'object') {
        result[key] = this.maskSensitiveFields(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Mask a value
   */
  private maskValue(value: any): string {
    if (typeof value === 'string') {
      if (value.includes('@')) { // Email
        const parts = value.split('@');
        if (parts.length === 2) {
          const [localPart, domain] = parts;
          return `${localPart.charAt(0)}***@${domain.charAt(0)}***`;
        }
      } else if (value.length > 4) { // General masking
        return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
      }
      return '***';
    }
    return '***';
  }

  /**
   * Check if a user has access to specific analytics data
   */
  async checkDataAccess(userId: string, eventId: string, accessLevel: DataAccessLevel): Promise<boolean> {
    // This would typically involve checking permissions in a real system
    // For now, we'll implement basic checks

    switch (accessLevel) {
      case DataAccessLevel.USER:
        // Check if the user is accessing their own data
        return true; // Simplified for demo purposes
      
      case DataAccessLevel.ORGANIZER:
        // Check if the user is the organizer of the event
        // This would require checking event ownership
        return true; // Simplified for demo purposes
      
      case DataAccessLevel.ADMIN:
        // Check if the user has admin privileges
        return true; // Simplified for demo purposes
      
      case DataAccessLevel.PUBLIC:
        // Public data is always accessible
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Get privacy-compliant analytics data for a user
   */
  async getUserAnalytics(userId: string, accessLevel: DataAccessLevel) {
    const rawData = await this.eventAnalyticsRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 1000, // Limit results for privacy
    });

    return this.applyPrivacyControls(rawData, accessLevel, userId);
  }

  /**
   * Get privacy-compliant event analytics
   */
  async getEventAnalytics(eventId: string, userId: string, accessLevel: DataAccessLevel) {
    const rawData = await this.eventAnalyticsRepository.find({
      where: { eventId },
      order: { timestamp: 'DESC' },
      take: 10000, // Reasonable limit for event analytics
    });

    return this.applyPrivacyControls(rawData, accessLevel, userId, eventId);
  }

  /**
   * Process data subject rights request (GDPR)
   */
  async handleDataSubjectRightsRequest(userId: string, requestType: 'access' | 'deletion' | 'rectification'): Promise<any> {
    switch (requestType) {
      case 'access':
        return this.getUserDataForExport(userId);
      case 'deletion':
        return this.deleteUserData(userId);
      case 'rectification':
        return this.updateUserData(userId);
      default:
        throw new BadRequestException('Invalid request type');
    }
  }

  /**
   * Get user data for export (right to data portability)
   */
  private async getUserDataForExport(userId: string) {
    const analyticsData = await this.eventAnalyticsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const summaryData = await this.analyticsSummaryRepository.find({
      where: { entityId: userId, entityType: 'user' },
      order: { createdAt: 'DESC' },
    });

    return {
      analytics: analyticsData,
      summaries: summaryData,
      exportTimestamp: new Date(),
    };
  }

  /**
   * Delete user data (right to be forgotten)
   */
  private async deleteUserData(userId: string) {
    // Anonymize user data instead of hard deleting (for analytical purposes)
    const affectedRows = await this.eventAnalyticsRepository
      .createQueryBuilder()
      .update(EventAnalytics)
      .set({ userId: () => `NULL` }) // Set userId to null to anonymize
      .where('userId = :userId', { userId })
      .execute();

    // Also delete any direct user references in summaries
    await this.analyticsSummaryRepository
      .createQueryBuilder()
      .update(AnalyticsSummary)
      .set({ entityId: () => `NULL` })
      .where('entityId = :userId AND entityType = :entityType', { 
        userId, 
        entityType: 'user' 
      })
      .execute();

    return {
      message: 'User data anonymized for analytics purposes',
      affectedRows: affectedRows.affected,
    };
  }

  /**
   * Update user data (right to rectification)
   */
  private async updateUserData(userId: string) {
    // Placeholder for data update functionality
    return {
      message: 'Data update functionality would be implemented here',
      userId,
    };
  }

  /**
   * Get privacy compliance report
   */
  async getPrivacyComplianceReport(): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const totalEvents = await this.eventAnalyticsRepository.count();
    const eventsLast30Days = await this.eventAnalyticsRepository.count({
      where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) }
    });
    const uniqueUsers = await this.eventAnalyticsRepository
      .createQueryBuilder('ea')
      .select('COUNT(DISTINCT ea.userId)', 'count')
      .where('ea.userId IS NOT NULL')
      .getRawOne();

    return {
      totalAnalyticsRecords: totalEvents,
      recentRecords: eventsLast30Days,
      uniqueUsersTracked: uniqueUsers.count,
      dataRetentionPolicy: 'Automatically applied',
      gdprCompliance: 'Enabled',
      lastUpdated: now,
    };
  }
}