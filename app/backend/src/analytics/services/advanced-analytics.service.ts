import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, In } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { AnalyticsSummary } from '../entities/analytics-summary.entity';
import { UserBehaviorAnalytics } from '../entities/user-behavior-analytics.entity';
import { MarketTrend } from '../entities/market-trend.entity';
import { CreateEventAnalyticsDto } from '../dto/create-event.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { UserBehaviorQueryDto } from '../dto/user-behavior-query.dto';
import { MarketTrendQueryDto } from '../dto/market-trend-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(AnalyticsSummary)
    private analyticsSummaryRepository: Repository<AnalyticsSummary>,
    @InjectRepository(UserBehaviorAnalytics)
    private userBehaviorRepository: Repository<UserBehaviorAnalytics>,
    @InjectRepository(MarketTrend)
    private marketTrendRepository: Repository<MarketTrend>,
  ) {}

  /**
   * Get comprehensive dashboard metrics with KPIs
   */
  async getDashboardKPIs(timePeriod: string = 'last_7_days') {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (timePeriod) {
      case 'today':
        startDate = startOfDay(now);
        previousStartDate = subDays(startDate, 1);
        break;
      case 'last_7_days':
        startDate = subDays(now, 7);
        previousStartDate = subDays(startDate, 7);
        break;
      case 'last_30_days':
        startDate = subDays(now, 30);
        previousStartDate = subDays(startDate, 30);
        break;
      case 'this_month':
        startDate = startOfMonth(now);
        previousStartDate = startOfMonth(subDays(now, 30));
        break;
      default:
        startDate = subDays(now, 7);
        previousStartDate = subDays(startDate, 7);
    }

    // Get current period data
    const currentEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: MoreThan(startDate)
      }
    });

    // Get previous period data for comparison
    const previousEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: Between(previousStartDate, startDate)
      }
    });

    const currentMetrics = this.calculateAggregateMetrics(currentEvents);
    const previousMetrics = this.calculateAggregateMetrics(previousEvents);

    // Calculate growth rates
    const growthRates = this.calculateGrowthRates(currentMetrics, previousMetrics);

    // Get user engagement metrics
    const engagementMetrics = await this.calculateEngagementMetrics(startDate, now);

    // Get market trends
    const marketTrends = await this.getLatestMarketTrends();

    return {
      period: timePeriod,
      current: currentMetrics,
      previous: previousMetrics,
      growth: growthRates,
      engagement: engagementMetrics,
      marketTrends,
      timestamp: new Date(),
    };
  }

  /**
   * Get user behavior analytics and engagement tracking
   */
  async getUserBehaviorAnalytics(queryDto: UserBehaviorQueryDto) {
    const { 
      userId, 
      timePeriod = 'last_30_days',
      behaviorType,
      limit = 100,
      offset = 0
    } = queryDto;

    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'last_7_days':
        startDate = subDays(now, 7);
        break;
      case 'last_30_days':
        startDate = subDays(now, 30);
        break;
      case 'last_90_days':
        startDate = subDays(now, 90);
        break;
      default:
        startDate = subDays(now, 30);
    }

    const queryBuilder = this.userBehaviorRepository.createQueryBuilder('user_behavior')
      .where('user_behavior.timestamp >= :startDate', { startDate })
      .orderBy('user_behavior.timestamp', 'DESC')
      .skip(offset)
      .take(limit);

    if (userId) {
      queryBuilder.andWhere('user_behavior.userId = :userId', { userId });
    }

    if (behaviorType) {
      queryBuilder.andWhere('user_behavior.behaviorType = :behaviorType', { behaviorType });
    }

    const behaviors = await queryBuilder.getMany();

    // Calculate behavior patterns
    const patterns = this.analyzeBehaviorPatterns(behaviors);

    // Calculate engagement score
    const engagementScore = this.calculateEngagementScore(behaviors);

    return {
      data: behaviors,
      patterns,
      engagementScore,
      summary: {
        totalBehaviors: behaviors.length,
        uniqueUsers: new Set(behaviors.map(b => b.userId)).size,
        behaviorTypes: [...new Set(behaviors.map(b => b.behaviorType))],
        timeRange: { startDate, endDate: now }
      }
    };
  }

  /**
   * Get market trend analysis and price predictions
   */
  async getMarketTrendAnalysis(queryDto: MarketTrendQueryDto) {
    const { 
      category,
      timePeriod = 'last_30_days',
      includePredictions = true
    } = queryDto;

    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'last_7_days':
        startDate = subDays(now, 7);
        break;
      case 'last_30_days':
        startDate = subDays(now, 30);
        break;
      case 'last_90_days':
        startDate = subDays(now, 90);
        break;
      case 'last_year':
        startDate = subDays(now, 365);
        break;
      default:
        startDate = subDays(now, 30);
    }

    const queryBuilder = this.marketTrendRepository.createQueryBuilder('market_trend')
      .where('market_trend.timestamp >= :startDate', { startDate })
      .orderBy('market_trend.timestamp', 'ASC');

    if (category) {
      queryBuilder.andWhere('market_trend.category = :category', { category });
    }

    const trends = await queryBuilder.getMany();

    // Analyze trends
    const trendAnalysis = this.analyzeMarketTrends(trends);

    // Generate predictions if requested
    let predictions = null;
    if (includePredictions) {
      predictions = await this.generatePricePredictions(trends);
    }

    return {
      data: trends,
      analysis: trendAnalysis,
      predictions,
      summary: {
        totalDataPoints: trends.length,
        categories: [...new Set(trends.map(t => t.category))],
        timeRange: { startDate, endDate: now }
      }
    };
  }

  /**
   * Get real-time analytics data
   */
  async getRealTimeMetrics() {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Recent events
    const recentEvents = await this.eventAnalyticsRepository.find({
      where: {
        timestamp: MoreThan(last5Minutes)
      }
    });

    // Active users in last hour
    const activeUsers = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.userId')
      .where('event.timestamp >= :lastHour', { lastHour })
      .andWhere('event.userId IS NOT NULL')
      .getRawMany();

    // Popular events
    const popularEvents = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('event.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp >= :lastHour', { lastHour })
      .andWhere('event.eventId IS NOT NULL')
      .groupBy('event.eventId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      timestamp: now,
      events: {
        last5Minutes: recentEvents.length,
        lastHour: await this.eventAnalyticsRepository.count({
          where: { timestamp: MoreThan(lastHour) }
        })
      },
      users: {
        activeNow: activeUsers.length,
        uniqueLastHour: activeUsers.length
      },
      popularEvents: popularEvents,
      systemHealth: await this.getSystemHealthMetrics()
    };
  }

  /**
   * Calculate growth rates between current and previous periods
   */
  private calculateGrowthRates(current: any, previous: any) {
    const growth: any = {};

    // Calculate growth for key metrics
    const metrics = ['totalEvents', 'uniqueUsers', 'uniqueEvents'];
    
    metrics.forEach(metric => {
      const currentVal = current[metric] || 0;
      const previousVal = previous[metric] || 0;
      
      if (previousVal === 0) {
        growth[metric] = currentVal > 0 ? 100 : 0;
      } else {
        growth[metric] = ((currentVal - previousVal) / previousVal) * 100;
      }
    });

    return growth;
  }

  /**
   * Calculate user engagement metrics
   */
  private async calculateEngagementMetrics(startDate: Date, endDate: Date) {
    // Session duration analytics
    const sessionData = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('event.sessionId', 'sessionId')
      .addSelect('MIN(event.timestamp)', 'sessionStart')
      .addSelect('MAX(event.timestamp)', 'sessionEnd')
      .addSelect('COUNT(*)', 'eventCount')
      .where('event.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.sessionId IS NOT NULL')
      .groupBy('event.sessionId')
      .getRawMany();

    const sessionDurations = sessionData.map(session => {
      const start = new Date(session.sessionStart);
      const end = new Date(session.sessionEnd);
      return (end.getTime() - start.getTime()) / 1000; // Convert to seconds
    });

    const avgSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
      : 0;

    // User retention calculation
    const returningUsers = await this.getReturningUsers(startDate, endDate);

    return {
      avgSessionDuration: Math.round(avgSessionDuration),
      totalSessions: sessionData.length,
      avgEventsPerSession: sessionData.length > 0 
        ? sessionData.reduce((sum, session) => sum + parseInt(session.eventCount), 0) / sessionData.length 
        : 0,
      returningUserRate: returningUsers.rate,
      bounceRate: await this.calculateBounceRate(startDate, endDate)
    };
  }

  /**
   * Analyze user behavior patterns
   */
  private analyzeBehaviorPatterns(behaviors: any[]) {
    const patterns: any = {
      timePatterns: {},
      behaviorFrequency: {},
      userJourneys: []
    };

    behaviors.forEach(behavior => {
      const hour = behavior.timestamp.getHours();
      patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1;
      
      patterns.behaviorFrequency[behavior.behaviorType] = 
        (patterns.behaviorFrequency[behavior.behaviorType] || 0) + 1;
    });

    // Find peak activity hours
    const peakHours = Object.entries(patterns.timePatterns)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    patterns.peakHours = peakHours;

    return patterns;
  }

  /**
   * Calculate engagement score for a user
   */
  private calculateEngagementScore(behaviors: any[]) {
    if (behaviors.length === 0) return 0;

    let score = 0;
    const weights = {
      'page_view': 1,
      'event_interaction': 3,
      'purchase': 10,
      'share': 5,
      'comment': 4,
      'like': 2
    };

    behaviors.forEach(behavior => {
      score += weights[behavior.behaviorType] || 1;
    });

    // Normalize score to 0-100 scale
    const maxPossibleScore = behaviors.length * 10;
    return Math.min(100, Math.round((score / maxPossibleScore) * 100));
  }

  /**
   * Analyze market trends
   */
  private analyzeMarketTrends(trends: any[]) {
    if (trends.length === 0) return null;

    const analysis: any = {
      trendDirection: 'stable',
      priceChange: 0,
      volatility: 0,
      support: 0,
      resistance: 0
    };

    // Calculate price change
    const firstPrice = trends[0].averagePrice;
    const lastPrice = trends[trends.length - 1].averagePrice;
    analysis.priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Determine trend direction
    if (analysis.priceChange > 5) {
      analysis.trendDirection = 'bullish';
    } else if (analysis.priceChange < -5) {
      analysis.trendDirection = 'bearish';
    }

    // Calculate volatility
    const prices = trends.map(t => t.averagePrice);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    analysis.volatility = Math.sqrt(variance);

    // Find support and resistance levels
    const sortedPrices = [...prices].sort((a, b) => a - b);
    analysis.support = sortedPrices[Math.floor(sortedPrices.length * 0.1)];
    analysis.resistance = sortedPrices[Math.floor(sortedPrices.length * 0.9)];

    return analysis;
  }

  /**
   * Generate price predictions using simple linear regression
   */
  private async generatePricePredictions(trends: any[]) {
    if (trends.length < 2) return null;

    // Simple linear regression for price prediction
    const prices = trends.map((t, i) => ({ x: i, y: t.averagePrice }));
    const n = prices.length;
    
    const sumX = prices.reduce((sum, p) => sum + p.x, 0);
    const sumY = prices.reduce((sum, p) => sum + p.y, 0);
    const sumXY = prices.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = prices.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next 7 days
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const predictedPrice = slope * (n + i - 1) + intercept;
      predictions.push({
        date: format(new Date(Date.now() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        predictedPrice: Math.max(0, predictedPrice),
        confidence: Math.max(0.5, 1 - (i * 0.1)) // Decreasing confidence
      });
    }

    return {
      method: 'linear_regression',
      predictions,
      accuracy: this.calculatePredictionAccuracy(trends, slope, intercept)
    };
  }

  /**
   * Calculate prediction accuracy
   */
  private calculatePredictionAccuracy(trends: any[], slope: number, intercept: number) {
    // Simple accuracy calculation based on recent data
    const recentTrends = trends.slice(-5);
    if (recentTrends.length < 2) return 0.5;

    let totalError = 0;
    recentTrends.forEach((trend, i) => {
      const predicted = slope * i + intercept;
      const actual = trend.averagePrice;
      totalError += Math.abs(predicted - actual) / actual;
    });

    return Math.max(0, 1 - (totalError / recentTrends.length));
  }

  /**
   * Get returning users rate
   */
  private async getReturningUsers(startDate: Date, endDate: Date) {
    const currentPeriodUsers = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.userId')
      .where('event.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.userId IS NOT NULL')
      .getRawMany();

    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    
    const previousPeriodUsers = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.userId')
      .where('event.timestamp BETWEEN :previousStartDate AND :startDate', { previousStartDate, startDate })
      .andWhere('event.userId IS NOT NULL')
      .getRawMany();

    const currentUsers = new Set(currentPeriodUsers.map(u => u.userId));
    const previousUsers = new Set(previousPeriodUsers.map(u => u.userId));
    
    const returningUsers = [...currentUsers].filter(userId => previousUsers.has(userId));
    
    return {
      total: currentUsers.size,
      returning: returningUsers.length,
      rate: currentUsers.size > 0 ? (returningUsers.length / currentUsers.size) * 100 : 0
    };
  }

  /**
   * Calculate bounce rate
   */
  private async calculateBounceRate(startDate: Date, endDate: Date) {
    const sessions = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('event.sessionId', 'sessionId')
      .addSelect('COUNT(*)', 'eventCount')
      .where('event.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.sessionId IS NOT NULL')
      .groupBy('event.sessionId')
      .getRawMany();

    const bouncedSessions = sessions.filter(session => parseInt(session.eventCount) === 1);
    
    return sessions.length > 0 ? (bouncedSessions.length / sessions.length) * 100 : 0;
  }

  /**
   * Get latest market trends
   */
  private async getLatestMarketTrends() {
    return await this.marketTrendRepository.find({
      order: { timestamp: 'DESC' },
      take: 10
    });
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics() {
    return {
      databaseStatus: 'healthy',
      apiResponseTime: Math.random() * 100 + 50, // Mock data
      errorRate: Math.random() * 5, // Mock data
      activeConnections: Math.floor(Math.random() * 1000) + 100 // Mock data
    };
  }

  /**
   * Reuse the existing calculateAggregateMetrics method
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
}
