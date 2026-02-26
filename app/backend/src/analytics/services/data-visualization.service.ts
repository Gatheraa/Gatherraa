import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { UserBehaviorAnalytics } from '../entities/user-behavior-analytics.entity';
import { MarketTrend } from '../entities/market-trend.entity';

@Injectable()
export class DataVisualizationService {
  private readonly logger = new Logger(DataVisualizationService.name);

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(UserBehaviorAnalytics)
    private userBehaviorRepository: Repository<UserBehaviorAnalytics>,
    @InjectRepository(MarketTrend)
    private marketTrendRepository: Repository<MarketTrend>,
  ) {}

  /**
   * Generate chart data for dashboard
   */
  async getDashboardChartData(timePeriod: string = 'last_30_days') {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      eventsOverTime: await this.getEventsOverTimeData(startDate, now),
      userEngagement: await this.getUserEngagementData(startDate, now),
      topEvents: await this.getTopEventsData(startDate, now),
      marketTrends: await this.getMarketTrendsChartData(startDate, now),
      behaviorPatterns: await this.getBehaviorPatternsData(startDate, now),
      conversionFunnel: await this.getConversionFunnelData(startDate, now)
    };
  }

  /**
   * Get events over time data for line chart
   */
  private async getEventsOverTimeData(startDate: Date, endDate: Date) {
    const events = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select("DATE(event.timestamp)", "date")
      .addSelect("COUNT(*)", "count")
      .where('event.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("DATE(event.timestamp)")
      .orderBy("date", "ASC")
      .getRawMany();

    return {
      type: 'line',
      title: 'Events Over Time',
      data: events.map(item => ({
        x: item.date,
        y: parseInt(item.count)
      })),
      labels: events.map(item => item.date),
      datasets: [{
        label: 'Daily Events',
        data: events.map(item => parseInt(item.count)),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      }]
    };
  }

  /**
   * Get user engagement data for bar chart
   */
  private async getUserEngagementData(startDate: Date, endDate: Date) {
    const engagement = await this.userBehaviorRepository
      .createQueryBuilder('behavior')
      .select("behavior.behaviorType", "type")
      .addSelect("COUNT(*)", "count")
      .where('behavior.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("behavior.behaviorType")
      .orderBy("count", "DESC")
      .getRawMany();

    return {
      type: 'bar',
      title: 'User Engagement by Type',
      data: engagement.map(item => ({
        x: item.type,
        y: parseInt(item.count)
      })),
      labels: engagement.map(item => item.type),
      datasets: [{
        label: 'Engagement Count',
        data: engagement.map(item => parseInt(item.count)),
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 205, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 205, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1
      }]
    };
  }

  /**
   * Get top events data for pie chart
   */
  private async getTopEventsData(startDate: Date, endDate: Date) {
    const topEvents = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select('event.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('event.eventId IS NOT NULL')
      .groupBy('event.eventId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      type: 'pie',
      title: 'Top Events',
      data: topEvents.map(item => ({
        name: item.eventId || 'Unknown',
        value: parseInt(item.count)
      })),
      labels: topEvents.map(item => item.eventId || 'Unknown'),
      datasets: [{
        data: topEvents.map(item => parseInt(item.count)),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF',
          '#4BC0C0',
          '#FF6384'
        ]
      }]
    };
  }

  /**
   * Get market trends data for area chart
   */
  private async getMarketTrendsChartData(startDate: Date, endDate: Date) {
    const trends = await this.marketTrendRepository
      .createQueryBuilder('trend')
      .select("trend.timestamp", "timestamp")
      .addSelect("trend.averagePrice", "price")
      .addSelect("trend.totalVolume", "volume")
      .where('trend.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('trend.timestamp', 'ASC')
      .getRawMany();

    return {
      type: 'area',
      title: 'Market Trends',
      data: {
        price: trends.map(item => ({
          x: item.timestamp,
          y: parseFloat(item.price)
        })),
        volume: trends.map(item => ({
          x: item.timestamp,
          y: parseInt(item.volume)
        }))
      },
      labels: trends.map(item => item.timestamp),
      datasets: [
        {
          label: 'Average Price',
          data: trends.map(item => parseFloat(item.price)),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y',
        },
        {
          label: 'Volume',
          data: trends.map(item => parseInt(item.volume)),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          yAxisID: 'y1',
        }
      ]
    };
  }

  /**
   * Get behavior patterns data for radar chart
   */
  private async getBehaviorPatternsData(startDate: Date, endDate: Date) {
    const patterns = await this.userBehaviorRepository
      .createQueryBuilder('behavior')
      .select("behavior.behaviorType", "type")
      .addSelect("COUNT(*)", "count")
      .addSelect("AVG(behavior.duration)", "avgDuration")
      .where('behavior.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("behavior.behaviorType")
      .getRawMany();

    return {
      type: 'radar',
      title: 'Behavior Patterns',
      data: patterns.map(item => ({
        behavior: item.type,
        frequency: parseInt(item.count),
        avgDuration: parseFloat(item.avgDuration) || 0
      })),
      labels: patterns.map(item => item.type),
      datasets: [{
        label: 'Behavior Frequency',
        data: patterns.map(item => parseInt(item.count)),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      }, {
        label: 'Average Duration (seconds)',
        data: patterns.map(item => parseFloat(item.avgDuration) || 0),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      }]
    };
  }

  /**
   * Get conversion funnel data
   */
  private async getConversionFunnelData(startDate: Date, endDate: Date) {
    // Define funnel stages
    const funnelStages = [
      'page_view',
      'event_interaction',
      'add_to_cart',
      'purchase'
    ];

    const funnelData = [];

    for (const stage of funnelStages) {
      const count = await this.userBehaviorRepository
        .createQueryBuilder('behavior')
        .where('behavior.behaviorType = :stage', { stage })
        .andWhere('behavior.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getCount();

      funnelData.push({
        stage: stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count,
        conversionRate: 0 // Will be calculated
      });
    }

    // Calculate conversion rates
    for (let i = 1; i < funnelData.length; i++) {
      if (funnelData[i - 1].count > 0) {
        funnelData[i].conversionRate = (funnelData[i].count / funnelData[i - 1].count) * 100;
      }
    }

    return {
      type: 'funnel',
      title: 'Conversion Funnel',
      data: funnelData,
      labels: funnelData.map(item => item.stage),
      datasets: [{
        label: 'User Count',
        data: funnelData.map(item => item.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ]
      }]
    };
  }

  /**
   * Generate heatmap data for user activity
   */
  async getActivityHeatmap(timePeriod: string = 'last_30_days') {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case 'last_7_days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const activity = await this.userBehaviorRepository
      .createQueryBuilder('behavior')
      .select("DAYOFWEEK(behavior.timestamp)", "dayOfWeek")
      .addSelect("HOUR(behavior.timestamp)", "hourOfDay")
      .addSelect("COUNT(*)", "count")
      .where('behavior.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate: now })
      .groupBy("DAYOFWEEK(behavior.timestamp), HOUR(behavior.timestamp)")
      .getRawMany();

    // Transform data for heatmap
    const heatmapData = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const found = activity.find(item => 
          parseInt(item.dayOfWeek) === day + 1 && 
          parseInt(item.hourOfDay) === hour
        );
        
        heatmapData.push({
          x: hour,
          y: day,
          v: found ? parseInt(found.count) : 0
        });
      }
    }

    return {
      type: 'heatmap',
      title: 'User Activity Heatmap',
      data: heatmapData,
      xAxisLabels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      yAxisLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    };
  }

  /**
   * Get real-time chart data
   */
  async getRealTimeChartData() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const recentEvents = await this.eventAnalyticsRepository
      .createQueryBuilder('event')
      .select("DATE_FORMAT(event.timestamp, '%Y-%m-%d %H:%i')", "minute")
      .addSelect("COUNT(*)", "count")
      .where('event.timestamp >= :lastHour', { lastHour })
      .groupBy("DATE_FORMAT(event.timestamp, '%Y-%m-%d %H:%i')")
      .orderBy("minute", "ASC")
      .getRawMany();

    return {
      type: 'realtime',
      title: 'Real-time Activity',
      data: recentEvents.map(item => ({
        time: item.minute,
        events: parseInt(item.count)
      })),
      lastUpdated: now
    };
  }
}
