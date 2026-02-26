import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBehaviorAnalytics } from '../entities/user-behavior-analytics.entity';
import { CreateUserBehaviorDto } from '../dto/create-user-behavior.dto';

@Injectable()
export class UserBehaviorService {
  private readonly logger = new Logger(UserBehaviorService.name);

  constructor(
    @InjectRepository(UserBehaviorAnalytics)
    private userBehaviorRepository: Repository<UserBehaviorAnalytics>,
  ) {}

  /**
   * Track user behavior event
   */
  async trackBehavior(createBehaviorDto: CreateUserBehaviorDto): Promise<UserBehaviorAnalytics> {
    const behavior = new UserBehaviorAnalytics();
    
    behavior.userId = createBehaviorDto.userId;
    behavior.behaviorType = createBehaviorDto.behaviorType;
    behavior.behaviorData = createBehaviorDto.behaviorData || {};
    behavior.context = createBehaviorDto.context || {};
    behavior.targetEntity = createBehaviorDto.targetEntity;
    behavior.entityType = createBehaviorDto.entityType;
    behavior.userProperties = createBehaviorDto.userProperties || {};
    behavior.sessionId = createBehaviorDto.sessionId;
    behavior.timestamp = createBehaviorDto.timestamp ? new Date(createBehaviorDto.timestamp) : new Date();
    behavior.source = createBehaviorDto.source;
    behavior.device = createBehaviorDto.device;
    behavior.location = createBehaviorDto.location;
    behavior.value = createBehaviorDto.value;
    behavior.duration = createBehaviorDto.duration;
    behavior.isConverted = createBehaviorDto.isConverted || false;
    behavior.attribution = createBehaviorDto.attribution || {};

    return await this.userBehaviorRepository.save(behavior);
  }

  /**
   * Get user behavior history
   */
  async getUserBehaviorHistory(userId: string, limit: number = 100) {
    return await this.userBehaviorRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get behavior patterns for a user
   */
  async getUserPatterns(userId: string, timePeriod: string = 'last_30_days') {
    const behaviors = await this.getUserBehaviorHistory(userId, 1000);
    
    // Analyze patterns
    const patterns = {
      preferredTimeOfDay: this.getPreferredTimeOfDay(behaviors),
      behaviorFrequency: this.getBehaviorFrequency(behaviors),
      conversionPath: this.getConversionPath(behaviors),
      engagementTrend: this.getEngagementTrend(behaviors)
    };

    return patterns;
  }

  private getPreferredTimeOfDay(behaviors: any[]) {
    const hourCounts: Record<number, number> = {};
    
    behaviors.forEach(behavior => {
      const hour = behavior.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const maxHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];

    return {
      peakHour: maxHour ? parseInt(maxHour[0]) : null,
      distribution: hourCounts
    };
  }

  private getBehaviorFrequency(behaviors: any[]) {
    const frequency: Record<string, number> = {};
    
    behaviors.forEach(behavior => {
      frequency[behavior.behaviorType] = (frequency[behavior.behaviorType] || 0) + 1;
    });

    return frequency;
  }

  private getConversionPath(behaviors: any[]) {
    return behaviors
      .filter(b => b.isConverted)
      .map(b => ({
        behaviorType: b.behaviorType,
        timestamp: b.timestamp,
        value: b.value
      }));
  }

  private getEngagementTrend(behaviors: any[]) {
    // Group by day and count behaviors
    const dailyEngagement: Record<string, number> = {};
    
    behaviors.forEach(behavior => {
      const day = behavior.timestamp.toISOString().split('T')[0];
      dailyEngagement[day] = (dailyEngagement[day] || 0) + 1;
    });

    return Object.entries(dailyEngagement)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
