import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, In } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { AnalyticsSummary } from '../entities/analytics-summary.entity';
import { CreateEventAnalyticsDto } from '../dto/create-event.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

@Injectable()
export class AnalyticsService {
  private readonly logger = Logger;

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(AnalyticsSummary)
    private analyticsSummaryRepository: Repository<AnalyticsSummary>,
  ) {}

  /**
   * Track an event with analytics data
   */
  async trackEvent(createEventDto: CreateEventAnalyticsDto): Promise<EventAnalytics> {
    const eventAnalytics = new EventAnalytics();
    
    eventAnalytics.eventId = createEventDto.eventId;
    eventAnalytics.userId = createEventDto.userId;
    eventAnalytics.eventType = createEventDto.eventType;
    eventAnalytics.metrics = createEventDto.metrics;
    eventAnalytics.eventData = createEventDto.eventData || {};
    eventAnalytics.userProperties = createEventDto.userProperties || {};
    eventAnalytics.source = createEventDto.source;
    eventAnalytics.sessionId = createEventDto.sessionId;
    eventAnalytics.timestamp = createEventDto.timestamp ? new Date(createEventDto.timestamp) : new Date();

    return await this.eventAnalyticsRepository.save(eventAnalytics);
  }

  /**
   * Get analytics data based on query parameters
   */
  async getAnalytics(queryDto: AnalyticsQueryDto) {
    const { 
      eventId, 
      userId, 
      timePeriod, 
      startDate, 
      endDate, 
      metricType, 
      groupBy,
      limit = 100,
      offset = 0
    } = queryDto;

    let dateFilter: any = {};

    // Handle time period filters
    if (startDate && endDate) {
      dateFilter = { 
        timestamp: Between(new Date(startDate), new Date(endDate)) 
      };
    } else {
      const now = new Date();
      switch (timePeriod) {
        case 'today':
          dateFilter = { 
            timestamp: Between(startOfDay(now), endOfDay(now)) 
          };
          break;
        case 'yesterday':
          const yesterday = subDays(now, 1);
          dateFilter = { 
            timestamp: Between(startOfDay(yesterday), endOfDay(yesterday)) 
          };
          break;
        case 'last_7_days':
          dateFilter = { 
            timestamp: MoreThan(subDays(now, 7)) 
          };
          break;
        case 'last_30_days':
          dateFilter = { 
            timestamp: MoreThan(subDays(now, 30)) 
          };
          break;
        case 'this_week':
          dateFilter = { 
            timestamp: Between(startOfWeek(now), endOfWeek(now)) 
          };
          break;
        case 'last_week':
          const lastWeekStart = startOfWeek(subDays(now, 7));
          const lastWeekEnd = endOfWeek(subDays(now, 7));
          dateFilter = { 
            timestamp: Between(lastWeekStart, lastWeekEnd) 
          };
          break;
        case 'this_month':
          dateFilter = { 
            timestamp: Between(startOfMonth(now), endOfMonth(now)) 
          };
          break;
        case 'last_month':
          const lastMonthStart = startOfMonth(subDays(now, 30));
          const lastMonthEnd = endOfMonth(subDays(now, 30));
          dateFilter = { 
            timestamp: Between(lastMonthStart, lastMonthEnd) 
          };
          break;
        default:
          // Default to last 7 days
          dateFilter = { 
            timestamp: MoreThan(subDays(now, 7)) 
          };
          break;
      }
    }

    // Build query
    const queryBuilder = this.eventAnalyticsRepository.createQueryBuilder('event_analytics')
      .where(dateFilter);

    if (eventId) {
      queryBuilder.andWhere('event_analytics.eventId = :eventId', { eventId });
    }

    if (userId) {
      queryBuilder.andWhere('event_analytics.userId = :userId', { userId });
    }

    if (metricType) {
      queryBuilder.andWhere('event_analytics.eventType = :metricType', { metricType });
    }

    // Apply pagination
    queryBuilder.skip(offset).take(limit);

    const results = await queryBuilder.getMany();

    // Calculate aggregate metrics
    const aggregateMetrics = this.calculateAggregateMetrics(results);

    return {
      data: results,
      aggregates: aggregateMetrics,
      total: results.length,
      query: queryDto
    };
  }

  /**
   * Calculate aggregate metrics from raw event data
   */
  private calculateAggregateMetrics(events: EventAnalytics[]) {
    const aggregates: Record<string, any> = {
      totalEvents: events.length,
      eventTypes: {},
      uniqueUsers: new Set(events.filter(e => e.userId).map(e => e.userId)).size,
      uniqueEvents: new Set(events.filter(e => e.eventId).map(e => e.eventId)).size,
      timestamps: {
        earliest: events.length > 0 && events.some(e => e.timestamp) ? new Date(Math.min(...events.filter(e => e.timestamp).map(e => e.timestamp!).map(t => t.getTime()))) : null,
        latest: events.length > 0 && events.some(e => e.timestamp) ? new Date(Math.max(...events.filter(e => e.timestamp).map(e => e.timestamp!).map(t => t.getTime()))) : null,
      },
      metrics: {}
    };

    // Count event types
    events.forEach(event => {
      if (event.eventType) {
        aggregates.eventTypes[event.eventType] = (aggregates.eventTypes[event.eventType] || 0) + 1;
      }

      // Aggregate metrics
      if (event.metrics) {
        Object.keys(event.metrics).forEach(key => {
          if (!aggregates.metrics[key]) {
            aggregates.metrics[key] = {
              sum: 0,
              count: 0,
              avg: 0,
              min: Infinity,
              max: -Infinity
            };
          }

          const value = event.metrics[key];
          if (typeof value === 'number') {
            aggregates.metrics[key].sum += value;
            aggregates.metrics[key].count++;
            aggregates.metrics[key].min = Math.min(aggregates.metrics[key].min, value);
            aggregates.metrics[key].max = Math.max(aggregates.metrics[key].max, value);
          }
        });
      }
    });

    // Calculate averages
    Object.keys(aggregates.metrics).forEach(key => {
      if (aggregates.metrics[key].count > 0) {
        aggregates.metrics[key].avg = aggregates.metrics[key].sum / aggregates.metrics[key].count;
      }
    });

    return aggregates;
  }

  /**
   * Generate daily analytics summary
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateDailySummary() {
    this.logger.log('Generating daily analytics summary...');
    
    const now = new Date();
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);

    // Get today's events
    const todayEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: Between(startOfToday, endOfToday),
        isProcessed: false
      }
    });

    if (todayEvents.length === 0) {
      return;
    }

    // Process and summarize today's events
    const summaryData = this.calculateAggregateMetrics(todayEvents);
    
    // Create summary record
    const summary = new AnalyticsSummary();
    summary.metricType = 'daily';
    summary.period = 'daily';
    summary.periodStart = startOfToday;
    summary.periodEnd = endOfToday;
    summary.summaryData = summaryData;
    summary.isAnomalyDetected = false; // Will be determined later

    await this.analyticsSummaryRepository.save(summary);

    // Mark events as processed
    await this.eventAnalyticsRepository.update(
      { id: In(todayEvents.map(e => e.id)) },
      { isProcessed: true }
    );

    this.logger.log(`Generated daily summary with ${todayEvents.length} events`);
  }

  /**
   * Generate weekly analytics summary
   */
  @Cron('0 0 * * 1') // Run at midnight on Monday
  async generateWeeklySummary() {
    this.logger.log('Generating weekly analytics summary...');
    
    const now = new Date();
    const startOfWeekDate = startOfWeek(now);
    const endOfWeekDate = endOfWeek(now);

    // Get week's events
    const weekEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: Between(startOfWeekDate, endOfWeekDate)
      }
    });

    if (weekEvents.length === 0) {
      return;
    }

    // Process and summarize week's events
    const summaryData = this.calculateAggregateMetrics(weekEvents);
    
    // Create summary record
    const summary = new AnalyticsSummary();
    summary.metricType = 'weekly';
    summary.period = 'weekly';
    summary.periodStart = startOfWeekDate;
    summary.periodEnd = endOfWeekDate;
    summary.summaryData = summaryData;
    summary.isAnomalyDetected = false;

    await this.analyticsSummaryRepository.save(summary);

    this.logger.log(`Generated weekly summary with ${weekEvents.length} events`);
  }

  /**
   * Generate monthly analytics summary
   */
  @Cron('0 0 1 * *') // Run at midnight on the first day of each month
  async generateMonthlySummary() {
    this.logger.log('Generating monthly analytics summary...');
    
    const now = new Date();
    const startOfMonthDate = startOfMonth(now);
    const endOfMonthDate = endOfMonth(now);

    // Get month's events
    const monthEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: Between(startOfMonthDate, endOfMonthDate)
      }
    });

    if (monthEvents.length === 0) {
      return;
    }

    // Process and summarize month's events
    const summaryData = this.calculateAggregateMetrics(monthEvents);
    
    // Create summary record
    const summary = new AnalyticsSummary();
    summary.metricType = 'monthly';
    summary.period = 'monthly';
    summary.periodStart = startOfMonthDate;
    summary.periodEnd = endOfMonthDate;
    summary.summaryData = summaryData;
    summary.isAnomalyDetected = false;

    await this.analyticsSummaryRepository.save(summary);

    this.logger.log(`Generated monthly summary with ${monthEvents.length} events`);
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(timePeriod: string = 'last_7_days') {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'last_7_days':
        startDate = subDays(now, 7);
        break;
      case 'last_30_days':
        startDate = subDays(now, 30);
        break;
      case 'this_month':
        startDate = startOfMonth(now);
        break;
      default:
        startDate = subDays(now, 7);
    }

    const events = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: MoreThan(startDate)
      }
    });

    return this.calculateAggregateMetrics(events);
  }

  /**
   * Get event-specific analytics
   */
  async getEventAnalytics(eventId: string, timePeriod: string = 'last_7_days') {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'last_7_days':
        startDate = subDays(now, 7);
        break;
      case 'last_30_days':
        startDate = subDays(now, 30);
        break;
      case 'this_month':
        startDate = startOfMonth(now);
        break;
      default:
        startDate = subDays(now, 7);
    }

    const events = await this.eventAnalyticsRepository.find({
      where: {
        eventId,
        timestamp: MoreThan(startDate)
      }
    });

    return this.calculateAggregateMetrics(events);
  }
}