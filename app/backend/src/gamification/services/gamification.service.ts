import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { Leaderboard } from '../entities/leaderboard.entity';
import { LeaderboardEntry } from '../entities/leaderboard.entity';
import { Challenge } from '../entities/challenge.entity';
import { UserChallenge } from '../entities/challenge.entity';
import { Streak } from '../entities/streak.entity';
import { StreakActivity } from '../entities/streak.entity';
import { Guild } from '../entities/guild.entity';
import { GuildMember } from '../entities/guild.entity';
import { SeasonalEvent } from '../entities/seasonal-event.entity';
import { UserEventParticipation } from '../entities/seasonal-event.entity';
import { GamificationAnalytics } from '../entities/gamification-analytics.entity';
import { EngagementMetrics } from '../entities/gamification-analytics.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(Leaderboard)
    private leaderboardRepository: Repository<Leaderboard>,
    @InjectRepository(LeaderboardEntry)
    private leaderboardEntryRepository: Repository<LeaderboardEntry>,
    @InjectRepository(Challenge)
    private challengeRepository: Repository<Challenge>,
    @InjectRepository(UserChallenge)
    private userChallengeRepository: Repository<UserChallenge>,
    @InjectRepository(Streak)
    private streakRepository: Repository<Streak>,
    @InjectRepository(StreakActivity)
    private streakActivityRepository: Repository<StreakActivity>,
    @InjectRepository(Guild)
    private guildRepository: Repository<Guild>,
    @InjectRepository(GuildMember)
    private guildMemberRepository: Repository<GuildMember>,
    @InjectRepository(SeasonalEvent)
    private seasonalEventRepository: Repository<SeasonalEvent>,
    @InjectRepository(UserEventParticipation)
    private userEventParticipationRepository: Repository<UserEventParticipation>,
    @InjectRepository(GamificationAnalytics)
    private analyticsRepository: Repository<GamificationAnalytics>,
    @InjectRepository(EngagementMetrics)
    private engagementMetricsRepository: Repository<EngagementMetrics>,
  ) {}

  // Achievement System Methods
  async createAchievement(achievementData: Partial<Achievement>): Promise<Achievement> {
    const achievement = this.achievementRepository.create(achievementData);
    return await this.achievementRepository.save(achievement);
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return await this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });
  }

  async updateAchievementProgress(
    userId: string,
    achievementId: string,
    progress: number,
    evidence?: any,
  ): Promise<UserAchievement> {
    let userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId },
      relations: ['achievement'],
    });

    if (!userAchievement) {
      const achievement = await this.achievementRepository.findOne({
        where: { id: achievementId },
      });
      
      userAchievement = this.userAchievementRepository.create({
        userId,
        achievementId,
        status: 'in_progress',
        progress: {
          current: 0,
          target: achievement.criteria.target,
          percentage: 0,
          lastUpdated: new Date(),
        },
      });
    }

    userAchievement.progress.current = Math.min(progress, userAchievement.achievement.criteria.target);
    userAchievement.progress.percentage = (userAchievement.progress.current / userAchievement.progress.target) * 100;
    userAchievement.progress.lastUpdated = new Date();

    if (userAchievement.progress.current >= userAchievement.progress.target) {
      userAchievement.status = 'completed';
      userAchievement.completedAt = new Date();
      await this.awardAchievementRewards(userId, userAchievement);
    }

    if (evidence) {
      if (!userAchievement.evidence) userAchievement.evidence = [];
      userAchievement.evidence.push({
        type: evidence.type || 'manual',
        data: evidence.data,
        timestamp: new Date(),
        verified: evidence.verified || false,
      });
    }

    return await this.userAchievementRepository.save(userAchievement);
  }

  private async awardAchievementRewards(userId: string, userAchievement: UserAchievement): Promise<void> {
    const rewards = userAchievement.achievement.rewards;
    if (!rewards) return;

    for (const reward of rewards) {
      switch (reward.type) {
        case 'points':
          await this.addUserPoints(userId, reward.value as number);
          break;
        case 'token':
          await this.addUserTokens(userId, reward.value as number);
          break;
        case 'badge':
          await this.awardBadge(userId, reward.value as string);
          break;
        case 'title':
          await this.awardTitle(userId, reward.value as string);
          break;
      }
    }

    await this.trackAnalytics(userId, 'achievement_completed', {
      achievementId: userAchievement.achievementId,
      rewards: rewards,
    });
  }

  // Leaderboard Methods
  async createLeaderboard(leaderboardData: Partial<Leaderboard>): Promise<Leaderboard> {
    const leaderboard = this.leaderboardRepository.create(leaderboardData);
    return await this.leaderboardRepository.save(leaderboard);
  }

  async getLeaderboard(leaderboardId: string, limit = 100): Promise<LeaderboardEntry[]> {
    return await this.leaderboardEntryRepository.find({
      where: { leaderboardId },
      relations: ['user'],
      order: { rank: 'ASC' },
      take: limit,
    });
  }

  async updateUserLeaderboardScore(
    userId: string,
    leaderboardId: string,
    score: number,
    breakdown: Record<string, number>,
  ): Promise<LeaderboardEntry> {
    let entry = await this.leaderboardEntryRepository.findOne({
      where: { userId, leaderboardId },
    });

    if (!entry) {
      entry = this.leaderboardEntryRepository.create({
        userId,
        leaderboardId,
        score,
        breakdown,
        rank: 0,
      });
    } else {
      entry.score = score;
      entry.breakdown = breakdown;
    }

    entry = await this.leaderboardEntryRepository.save(entry);
    await this.recalculateLeaderboardRanks(leaderboardId);
    
    return entry;
  }

  private async recalculateLeaderboardRanks(leaderboardId: string): Promise<void> {
    const entries = await this.leaderboardEntryRepository.find({
      where: { leaderboardId },
      order: { score: 'DESC' },
    });

    let currentRank = 1;
    let previousScore = null;
    let ties = 0;

    for (const entry of entries) {
      if (previousScore !== null && entry.score === previousScore) {
        ties++;
      } else {
        currentRank += ties;
        ties = 0;
      }
      
      entry.rank = currentRank;
      entry.previousRank = entry.rank;
      entry.rankChange = entry.rank - entry.previousRank;
      entry.isTied = ties > 0;
      entry.tieCount = ties + 1;
      
      await this.leaderboardEntryRepository.save(entry);
      previousScore = entry.score;
    }
  }

  // Challenge System Methods
  async createChallenge(challengeData: Partial<Challenge>): Promise<Challenge> {
    const challenge = this.challengeRepository.create(challengeData);
    return await this.challengeRepository.save(challenge);
  }

  async enrollUserInChallenge(userId: string, challengeId: string): Promise<UserChallenge> {
    let userChallenge = await this.userChallengeRepository.findOne({
      where: { userId, challengeId },
    });

    if (!userChallenge) {
      userChallenge = this.userChallengeRepository.create({
        userId,
        challengeId,
        status: 'not_started',
        progress: {
          currentStep: 0,
          completedObjectives: [],
          overallProgress: 0,
          timeSpent: 0,
          lastActivity: new Date(),
        },
      });
    }

    return await this.userChallengeRepository.save(userChallenge);
  }

  async updateChallengeProgress(
    userId: string,
    challengeId: string,
    objectiveId: string,
    progress: number,
  ): Promise<UserChallenge> {
    const userChallenge = await this.userChallengeRepository.findOne({
      where: { userId, challengeId },
      relations: ['challenge'],
    });

    if (!userChallenge) {
      throw new Error('User not enrolled in challenge');
    }

    if (!userChallenge.objectiveProgress) {
      userChallenge.objectiveProgress = {};
    }

    userChallenge.objectiveProgress[objectiveId] = {
      current: progress,
      target: userChallenge.challenge.objectives.find(obj => obj.id === objectiveId).target,
      completed: false,
    };

    if (userChallenge.objectiveProgress[objectiveId].current >= userChallenge.objectiveProgress[objectiveId].target) {
      userChallenge.objectiveProgress[objectiveId].completed = true;
      userChallenge.objectiveProgress[objectiveId].completedAt = new Date();
      
      if (!userChallenge.progress.completedObjectives.includes(objectiveId)) {
        userChallenge.progress.completedObjectives.push(objectiveId);
      }
    }

    const totalObjectives = userChallenge.challenge.objectives.length;
    const completedObjectives = userChallenge.progress.completedObjectives.length;
    userChallenge.progress.overallProgress = (completedObjectives / totalObjectives) * 100;

    if (userChallenge.progress.overallProgress >= 100) {
      userChallenge.status = 'completed';
      userChallenge.completedAt = new Date();
      await this.awardChallengeRewards(userId, userChallenge);
    }

    userChallenge.progress.lastActivity = new Date();
    return await this.userChallengeRepository.save(userChallenge);
  }

  private async awardChallengeRewards(userId: string, userChallenge: UserChallenge): Promise<void> {
    const rewards = userChallenge.challenge.rewards;
    
    if (rewards.points) {
      await this.addUserPoints(userId, rewards.points);
    }
    
    if (rewards.tokens) {
      await this.addUserTokens(userId, rewards.tokens);
    }

    await this.trackAnalytics(userId, 'challenge_completed', {
      challengeId: userChallenge.challengeId,
      rewards: rewards,
    });
  }

  // Streak System Methods
  async createStreak(streakData: Partial<Streak>): Promise<Streak> {
    const streak = this.streakRepository.create(streakData);
    return await this.streakRepository.save(streak);
  }

  async updateStreakActivity(userId: string, streakId: string, activity: any): Promise<Streak> {
    const streak = await this.streakRepository.findOne({
      where: { userId, id: streakId },
    });

    if (!streak) {
      throw new Error('Streak not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = streak.lastActivityDate.toISOString().split('T')[0];

    let streakActivity = await this.streakActivityRepository.findOne({
      where: { streakId, activityDate: today },
    });

    if (!streakActivity) {
      streakActivity = this.streakActivityRepository.create({
        streakId,
        activityDate: new Date(today),
        activityTime: new Date(),
        activity,
        isCompleted: true,
        count: 1,
      });
    } else {
      streakActivity.count += 1;
    }

    await this.streakActivityRepository.save(streakActivity);

    // Update streak logic
    if (lastActivity !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivity === yesterdayStr) {
        streak.currentStreak += 1;
      } else if (!streak.isProtected && streak.protectionUses > 0) {
        streak.protectionUses -= 1;
      } else {
        streak.currentStreak = 1;
      }
    }

    streak.lastActivityDate = new Date(today);
    
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    return await this.streakRepository.save(streak);
  }

  // Guild System Methods
  async createGuild(guildData: Partial<Guild>): Promise<Guild> {
    const guild = this.guildRepository.create(guildData);
    return await this.guildRepository.save(guild);
  }

  async joinGuild(userId: string, guildId: string): Promise<GuildMember> {
    let member = await this.guildMemberRepository.findOne({
      where: { userId, guildId },
    });

    if (!member) {
      member = this.guildMemberRepository.create({
        userId,
        guildId,
        role: 'member',
        contributions: {
          points: 0,
          challenges: 0,
          events: 0,
          mentoring: 0,
          collaboration: 0,
        },
        reputation: 0,
        activityScore: 0,
        joinedAt: new Date(),
        isActive: true,
      });
    }

    return await this.guildMemberRepository.save(member);
  }

  // Analytics Methods
  async trackAnalytics(userId: string, eventType: string, data: any): Promise<void> {
    const analytics = this.analyticsRepository.create({
      userId,
      type: 'user_engagement',
      eventType,
      eventData: {
        action: eventType,
        category: 'gamification',
        value: data.value || 0,
        metadata: data,
      },
      context: {
        timestamp: new Date(),
        sessionId: data.sessionId,
      },
      metrics: {
        engagementScore: 0,
        retentionRisk: 0,
        churnProbability: 0,
        lifetimeValue: 0,
        acquisitionCost: 0,
        satisfactionScore: 0,
      },
      gamificationImpact: {
        pointsEarned: data.pointsEarned || 0,
        achievementsUnlocked: data.achievementsUnlocked || 0,
        streaksMaintained: data.streaksMaintained || 0,
        challengesCompleted: data.challengesCompleted || 0,
        guildContributions: data.guildContributions || 0,
        socialInteractions: data.socialInteractions || 0,
      },
    });

    await this.analyticsRepository.save(analytics);
  }

  // Helper Methods
  private async addUserPoints(userId: string, points: number): Promise<void> {
    // Implementation would depend on your user points system
    this.logger.log(`Adding ${points} points to user ${userId}`);
  }

  private async addUserTokens(userId: string, tokens: number): Promise<void> {
    // Implementation would depend on your token system
    this.logger.log(`Adding ${tokens} tokens to user ${userId}`);
  }

  private async awardBadge(userId: string, badge: string): Promise<void> {
    // Implementation would depend on your badge system
    this.logger.log(`Awarding badge ${badge} to user ${userId}`);
  }

  private async awardTitle(userId: string, title: string): Promise<void> {
    // Implementation would depend on your title system
    this.logger.log(`Awarding title ${title} to user ${userId}`);
  }

  // Adaptive Difficulty System
  async calculateAdaptiveDifficulty(userId: string, baseDifficulty: number): Promise<number> {
    const userChallenges = await this.userChallengeRepository.find({
      where: { userId },
      relations: ['challenge'],
    });

    if (userChallenges.length === 0) return baseDifficulty;

    const recentChallenges = userChallenges
      .filter(uc => uc.completedAt && uc.completedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .slice(-10);

    if (recentChallenges.length < 3) return baseDifficulty;

    const averageScore = recentChallenges.reduce((sum, uc) => sum + uc.score, 0) / recentChallenges.length;
    const completionRate = recentChallenges.filter(uc => uc.status === 'completed').length / recentChallenges.length;

    let adjustment = 0;
    
    if (averageScore > 80 && completionRate > 0.8) {
      adjustment = 0.2; // Increase difficulty
    } else if (averageScore < 50 || completionRate < 0.5) {
      adjustment = -0.2; // Decrease difficulty
    }

    return Math.max(0.1, Math.min(1.0, baseDifficulty + adjustment));
  }

  // Personalization System
  async getPersonalizedRecommendations(userId: string): Promise<any[]> {
    const userAchievements = await this.getUserAchievements(userId);
    const userChallenges = await this.userChallengeRepository.find({
      where: { userId },
      relations: ['challenge'],
    });

    const recommendations = [];

    // Analyze user patterns and suggest relevant content
    const completedCategories = userAchievements
      .filter(ua => ua.status === 'completed')
      .map(ua => ua.achievement.category);

    const preferredDifficulty = this.calculatePreferredDifficulty(userChallenges);

    // Suggest new challenges based on patterns
    const suggestedChallenges = await this.challengeRepository.find({
      where: {
        difficulty: preferredDifficulty,
        isActive: true,
      },
      take: 5,
    });

    recommendations.push(...suggestedChallenges);

    return recommendations;
  }

  private calculatePreferredDifficulty(userChallenges: UserChallenge[]): string {
    if (userChallenges.length === 0) return 'medium';

    const difficulties = userChallenges.map(uc => uc.challenge.difficulty);
    const frequency = difficulties.reduce((acc, diff) => {
      acc[diff] = (acc[diff] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }
}
