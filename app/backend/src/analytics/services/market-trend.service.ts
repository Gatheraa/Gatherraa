import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { MarketTrend } from '../entities/market-trend.entity';
import { CreateMarketTrendDto } from '../dto/create-market-trend.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class MarketTrendService {
  private readonly logger = new Logger(MarketTrendService.name);

  constructor(
    @InjectRepository(MarketTrend)
    private marketTrendRepository: Repository<MarketTrend>,
  ) {}

  /**
   * Create or update market trend data
   */
  async createMarketTrend(createTrendDto: CreateMarketTrendDto): Promise<MarketTrend> {
    const trend = new MarketTrend();
    
    trend.category = createTrendDto.category;
    trend.subcategory = createTrendDto.subcategory;
    trend.region = createTrendDto.region;
    trend.timestamp = createTrendDto.timestamp ? new Date(createTrendDto.timestamp) : new Date();
    trend.averagePrice = createTrendDto.averagePrice;
    trend.minPrice = createTrendDto.minPrice;
    trend.maxPrice = createTrendDto.maxPrice;
    trend.totalVolume = createTrendDto.totalVolume;
    trend.totalValue = createTrendDto.totalValue;
    trend.priceChange = createTrendDto.priceChange;
    trend.volumeChange = createTrendDto.volumeChange;
    trend.metadata = createTrendDto.metadata || {};
    trend.seasonality = createTrendDto.seasonality || {};
    trend.predictions = createTrendDto.predictions || {};
    trend.confidence = createTrendDto.confidence;
    trend.dataSource = createTrendDto.dataSource;
    trend.isActive = createTrendDto.isActive !== false;

    return await this.marketTrendRepository.save(trend);
  }

  /**
   * Get market trends by category
   */
  async getTrendsByCategory(category: string, timePeriod: string = 'last_30_days') {
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

    return await this.marketTrendRepository.find({
      where: {
        category,
        timestamp: MoreThan(startDate),
        isActive: true
      },
      order: { timestamp: 'DESC' }
    });
  }

  /**
   * Generate price predictions using historical data
   */
  async generatePricePredictions(category: string, days: number = 7) {
    const historicalData = await this.getTrendsByCategory(category, 'last_90_days');
    
    if (historicalData.length < 2) {
      throw new Error('Insufficient historical data for predictions');
    }

    // Simple linear regression for prediction
    const prices = historicalData.map((t, i) => ({ x: i, y: t.averagePrice }));
    const n = prices.length;
    
    const sumX = prices.reduce((sum, p) => sum + p.x, 0);
    const sumY = prices.reduce((sum, p) => sum + p.y, 0);
    const sumXY = prices.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = prices.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate predictions
    const predictions = [];
    for (let i = 1; i <= days; i++) {
      const predictedPrice = slope * (n + i - 1) + intercept;
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        predictedPrice: Math.max(0, predictedPrice),
        confidence: Math.max(0.5, 1 - (i * 0.05))
      });
    }

    return {
      category,
      method: 'linear_regression',
      predictions,
      accuracy: this.calculatePredictionAccuracy(historicalData, slope, intercept)
    };
  }

  /**
   * Analyze market trends and identify patterns
   */
  async analyzeMarketTrends(category: string) {
    const trends = await this.getTrendsByCategory(category, 'last_90_days');
    
    if (trends.length === 0) {
      return { message: 'No trend data available' };
    }

    const analysis = {
      trendDirection: this.determineTrendDirection(trends),
      volatility: this.calculateVolatility(trends),
      seasonality: this.analyzeSeasonality(trends),
      priceMomentum: this.calculatePriceMomentum(trends),
      volumeTrend: this.analyzeVolumeTrend(trends),
      keyLevels: this.identifyKeyLevels(trends)
    };

    return analysis;
  }

  /**
   * Automated market data collection and analysis
   */
  @Cron(CronExpression.EVERY_HOUR)
  async collectMarketData() {
    this.logger.log('Collecting market data...');
    
    // This would integrate with external data sources
    // For now, we'll create sample data
    const categories = ['events', 'tickets', 'venues'];
    
    for (const category of categories) {
      try {
        await this.generateSampleMarketData(category);
      } catch (error) {
        this.logger.error(`Failed to collect data for ${category}: ${error.message}`);
      }
    }
  }

  private determineTrendDirection(trends: MarketTrend[]): string {
    if (trends.length < 2) return 'insufficient_data';
    
    const firstPrice = trends[0].averagePrice;
    const lastPrice = trends[trends.length - 1].averagePrice;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    if (change > 5) return 'bullish';
    if (change < -5) return 'bearish';
    return 'stable';
  }

  private calculateVolatility(trends: MarketTrend[]): number {
    const prices = trends.map(t => t.averagePrice);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    return Math.sqrt(variance);
  }

  private analyzeSeasonality(trends: MarketTrend[]): any {
    // Simple seasonality analysis by day of week
    const dayOfWeekData: Record<number, number[]> = {};
    
    trends.forEach(trend => {
      const dayOfWeek = trend.timestamp.getDay();
      if (!dayOfWeekData[dayOfWeek]) {
        dayOfWeekData[dayOfWeek] = [];
      }
      dayOfWeekData[dayOfWeek].push(trend.averagePrice);
    });

    const seasonality: Record<number, { avg: number; pattern: string }> = {};
    
    Object.entries(dayOfWeekData).forEach(([day, prices]) => {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      seasonality[parseInt(day)] = {
        avg,
        pattern: avg > 100 ? 'high' : avg > 50 ? 'medium' : 'low'
      };
    });

    return seasonality;
  }

  private calculatePriceMomentum(trends: MarketTrend[]): number {
    if (trends.length < 2) return 0;
    
    const recent = trends.slice(-7); // Last 7 data points
    const older = trends.slice(-14, -7); // Previous 7 data points
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, t) => sum + t.averagePrice, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.averagePrice, 0) / older.length;
    
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  private analyzeVolumeTrend(trends: MarketTrend[]): string {
    if (trends.length < 2) return 'insufficient_data';
    
    const recentVolume = trends.slice(-7).reduce((sum, t) => sum + t.totalVolume, 0);
    const olderVolume = trends.slice(-14, -7).reduce((sum, t) => sum + t.totalVolume, 0);
    
    if (olderVolume === 0) return 'stable';
    
    const change = ((recentVolume - olderVolume) / olderVolume) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  private identifyKeyLevels(trends: MarketTrend[]): any {
    const prices = trends.map(t => t.averagePrice).sort((a, b) => a - b);
    
    return {
      support: prices[Math.floor(prices.length * 0.1)],
      resistance: prices[Math.floor(prices.length * 0.9)],
      median: prices[Math.floor(prices.length * 0.5)]
    };
  }

  private calculatePredictionAccuracy(historicalData: MarketTrend[], slope: number, intercept: number): number {
    if (historicalData.length < 5) return 0.5;
    
    const testData = historicalData.slice(-5);
    let totalError = 0;
    
    testData.forEach((trend, i) => {
      const predicted = slope * (historicalData.length - 5 + i) + intercept;
      const actual = trend.averagePrice;
      totalError += Math.abs(predicted - actual) / actual;
    });
    
    return Math.max(0, 1 - (totalError / testData.length));
  }

  private async generateSampleMarketData(category: string) {
    // Generate sample market data for demonstration
    const basePrice = Math.random() * 100 + 50;
    const volume = Math.floor(Math.random() * 1000) + 100;
    
    const trendData: CreateMarketTrendDto = {
      category,
      averagePrice: basePrice + (Math.random() - 0.5) * 10,
      minPrice: basePrice - Math.random() * 20,
      maxPrice: basePrice + Math.random() * 20,
      totalVolume: volume,
      totalValue: basePrice * volume,
      priceChange: (Math.random() - 0.5) * 10,
      volumeChange: (Math.random() - 0.5) * 20,
      dataSource: 'automated',
      confidence: 0.8 + Math.random() * 0.2
    };
    
    await this.createMarketTrend(trendData);
  }
}
