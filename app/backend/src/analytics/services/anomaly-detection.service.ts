import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { AnalyticsSummary } from '../entities/analytics-summary.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays, differenceInHours, parseISO } from 'date-fns';


export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number;
  metricName: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  message: string;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(AnalyticsSummary)
    private analyticsSummaryRepository: Repository<AnalyticsSummary>,
  ) {}

  /**
   * Detect anomalies in event metrics
   */
  async detectEventAnomalies(eventId: string, timeWindowHours: number = 24): Promise<AnomalyDetectionResult[]> {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindowHours * 60 * 60 * 1000);
    
    // Get recent events for the specific event
    const recentEvents = await this.eventAnalyticsRepository.find({
      where: {
        eventId,
        timestamp: Between(startTime, now),
      },
      order: { timestamp: 'ASC' },
    });

    if (recentEvents.length < 3) {
      // Not enough data to detect anomalies
      return [];
    }

    // Analyze different metrics for anomalies
    const results: AnomalyDetectionResult[] = [];

    // Check for registration rate anomalies
    const registrationRateAnomaly = await this.detectRegistrationRateAnomaly(recentEvents, eventId);
    if (registrationRateAnomaly) {
      results.push(registrationRateAnomaly);
    }

    // Check for attendance rate anomalies
    const attendanceAnomaly = await this.detectAttendanceAnomaly(recentEvents, eventId);
    if (attendanceAnomaly) {
      results.push(attendanceAnomaly);
    }

    // Check for engagement metrics anomalies
    const engagementAnomaly = await this.detectEngagementAnomaly(recentEvents, eventId);
    if (engagementAnomaly) {
      results.push(engagementAnomaly);
    }

    return results;
  }

  /**
   * Detect anomalies in registration rate
   */
  private async detectRegistrationRateAnomaly(events: EventAnalytics[], eventId: string): Promise<AnomalyDetectionResult | null> {
    // Filter for registration events
    const registrationEvents = events.filter(e => e.eventType === 'register');
    const currentRate = registrationEvents.length;

    // Compare with historical average
    const historicalAvg = await this.getHistoricalAverage(eventId, 'register', 7); // Last 7 days
    
    if (historicalAvg === 0) {
      return null; // Not enough historical data
    }

    const rateChange = ((currentRate - historicalAvg) / historicalAvg) * 100;
    const threshold = 50; // 50% change threshold

    if (Math.abs(rateChange) > threshold) {
      return {
        isAnomaly: true,
        confidence: Math.min(Math.abs(rateChange) / 100, 1), // Cap at 100%
        metricName: 'registration_rate',
        currentValue: currentRate,
        baselineValue: historicalAvg,
        threshold,
        message: `Registration rate changed by ${rateChange.toFixed(2)}% compared to historical average`,
      };
    }

    return null;
  }

  /**
   * Detect anomalies in attendance
   */
  private async detectAttendanceAnomaly(events: EventAnalytics[], eventId: string): Promise<AnomalyDetectionResult | null> {
    // Filter for attendance/check-in events
    const attendanceEvents = events.filter(e => e.eventType === 'attend' || e.eventType === 'check_in');
    const currentAttendance = attendanceEvents.length;

    // Compare with expected attendance based on registrations
    const registrationEvents = events.filter(e => e.eventType === 'register');
    const expectedAttendance = registrationEvents.length * 0.7; // Assume 70% show-up rate

    if (expectedAttendance === 0) {
      return null; // No registrations, can't determine anomaly
    }

    const attendanceRatio = currentAttendance / Math.max(registrationEvents.length, 1);
    const baselineRatio = 0.7; // Historical baseline
    const threshold = 0.3; // 30% deviation threshold

    const ratioChange = Math.abs(attendanceRatio - baselineRatio);

    if (ratioChange > threshold) {
      return {
        isAnomaly: true,
        confidence: Math.min(ratioChange / 0.5, 1), // Cap at reasonable confidence
        metricName: 'attendance_rate',
        currentValue: attendanceRatio,
        baselineValue: baselineRatio,
        threshold,
        message: `Attendance rate of ${(attendanceRatio * 100).toFixed(2)}% deviates from expected ${baselineRatio * 100}%`,
      };
    }

    return null;
  }

  /**
   * Detect anomalies in engagement metrics
   */
  private async detectEngagementAnomaly(events: EventAnalytics[], eventId: string): Promise<AnomalyDetectionResult | null> {
    // Calculate engagement score based on various interaction events
    const engagementEvents = events.filter(e => 
      e.eventType === 'view' || 
      e.eventType === 'interact' || 
      e.eventType === 'share' ||
      e.eventType === 'feedback'
    );
    
    const currentEngagementScore = engagementEvents.length;

    // Compare with historical engagement
    const historicalAvg = await this.getHistoricalAverage(eventId, 'engagement', 7);
    
    if (historicalAvg === 0) {
      return null; // Not enough historical data
    }

    const engagementChange = ((currentEngagementScore - historicalAvg) / historicalAvg) * 100;
    const threshold = 60; // 60% change threshold

    if (Math.abs(engagementChange) > threshold) {
      return {
        isAnomaly: true,
        confidence: Math.min(Math.abs(engagementChange) / 100, 1),
        metricName: 'engagement_score',
        currentValue: currentEngagementScore,
        baselineValue: historicalAvg,
        threshold,
        message: `Engagement score changed by ${engagementChange.toFixed(2)}% compared to historical average`,
      };
    }

    return null;
  }

  /**
   * Get historical average for a specific metric
   */
  private async getHistoricalAverage(eventId: string, metricType: string, days: number): Promise<number> {
    const now = new Date();
    const startDate = subDays(now, days);

    let eventTypeFilter: string | string[];
    
    switch (metricType) {
      case 'register':
        eventTypeFilter = 'register';
        break;
      case 'engagement':
        eventTypeFilter = ['view', 'interact', 'share', 'feedback'];
        break;
      default:
        eventTypeFilter = metricType;
    }

    const queryBuilder = this.eventAnalyticsRepository.createQueryBuilder('event_analytics')
      .where('event_analytics.eventId = :eventId', { eventId })
      .andWhere('event_analytics.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: now,
      });

    if (Array.isArray(eventTypeFilter)) {
      queryBuilder.andWhere('event_analytics.eventType IN (:...eventTypes)', {
        eventTypes: eventTypeFilter,
      });
    } else {
      queryBuilder.andWhere('event_analytics.eventType = :eventType', {
        eventType: eventTypeFilter,
      });
    }

    const events = await queryBuilder.getMany();
    return events.length / days; // Average per day
  }

  /**
   * Perform statistical anomaly detection using standard deviation
   */
  async detectStatisticalAnomalies(data: number[], thresholdSigma: number = 2): Promise<number[]> {
    if (data.length < 3) {
      return []; // Need at least 3 data points for meaningful analysis
    }

    // Calculate mean and standard deviation
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    if (stdDev === 0) {
      return []; // All values are the same, no anomalies possible
    }

    // Find values that are more than thresholdSigma standard deviations from the mean
    const anomalies: number[] = [];
    const lowerBound = mean - (thresholdSigma * stdDev);
    const upperBound = mean + (thresholdSigma * stdDev);

    data.forEach(value => {
      if (value < lowerBound || value > upperBound) {
        anomalies.push(value);
      }
    });

    return anomalies;
  }

  /**
   * Periodically scan for anomalies in all events
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scanAllEventsForAnomalies(): Promise<void> {
    this.logger.log('Starting anomaly scan for all events...');

    // Get all unique event IDs from recent analytics
    const recentDate = subDays(new Date(), 7); // Look at events from last 7 days
    const eventIds = await this.eventAnalyticsRepository
      .createQueryBuilder('event_analytics')
      .select('DISTINCT event_analytics.eventId', 'eventId')
      .where('event_analytics.eventId IS NOT NULL')
      .andWhere('event_analytics.createdAt > :recentDate', { recentDate })
      .getRawMany();

    for (const { eventId } of eventIds) {
      if (eventId) {
        try {
          const anomalies = await this.detectEventAnomalies(eventId);
          
          if (anomalies.length > 0) {
            this.logger.warn(`Anomalies detected for event ${eventId}:`, anomalies);
            
            // Update the summary table to mark that anomalies were detected
            await this.markAnomaliesInSummary(eventId, anomalies);
          }
        } catch (error) {
          this.logger.error(`Error detecting anomalies for event ${eventId}:`, error.message);
        }
      }
    }

    this.logger.log('Completed anomaly scan for all events');
  }

  /**
   * Mark anomalies in the summary table
   */
  private async markAnomaliesInSummary(eventId: string, anomalies: AnomalyDetectionResult[]): Promise<void> {
    // Find the latest summary for this event
    const latestSummary = await this.analyticsSummaryRepository.findOne({
      where: { 
        entityId: eventId,
        entityType: 'event'
      },
      order: { createdAt: 'DESC' },
    });

    if (latestSummary) {
      latestSummary.isAnomalyDetected = true;
      latestSummary.summaryData.anomalies = anomalies;
      await this.analyticsSummaryRepository.save(latestSummary);
    }
  }

  /**
   * Get anomalies for a specific event
   */
  async getEventAnomalies(eventId: string, daysBack: number = 30): Promise<AnomalyDetectionResult[]> {
    const startDate = subDays(new Date(), daysBack);
    
    const summary = await this.analyticsSummaryRepository.findOne({
      where: {
        entityId: eventId,
        entityType: 'event',
        isAnomalyDetected: true,
        createdAt: MoreThan(startDate),
      },
      order: { createdAt: 'DESC' },
    });

    if (summary && summary.summaryData.anomalies) {
      return summary.summaryData.anomalies;
    }

    return [];
  }

  /**
   * Get overall system anomalies
   */
  async getSystemAnomalies(daysBack: number = 7): Promise<any[]> {
    const startDate = subDays(new Date(), daysBack);
    
    const summaries = await this.analyticsSummaryRepository.find({
      where: {
        isAnomalyDetected: true,
        createdAt: MoreThan(startDate),
      },
      order: { createdAt: 'DESC' },
    });

    return summaries.map(summary => ({
      id: summary.id,
      entityType: summary.entityType,
      entityId: summary.entityId,
      anomalies: summary.summaryData.anomalies || [],
      detectedAt: summary.createdAt,
    }));
  }
}