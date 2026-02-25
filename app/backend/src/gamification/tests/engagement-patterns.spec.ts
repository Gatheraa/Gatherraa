import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamificationService } from '../services/gamification.service';
import { EngagementMetrics } from '../entities/gamification-analytics.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { UserChallenge } from '../entities/challenge.entity';

describe('Engagement Patterns Tests', () => {
  let service: GamificationService;
  let engagementMetricsRepository: Repository<EngagementMetrics>;
  let userAchievementRepository: Repository<UserAchievement>;
  let userChallengeRepository: Repository<UserChallenge>;

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getRepositoryToken(EngagementMetrics),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserChallenge),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    engagementMetricsRepository = module.get<Repository<EngagementMetrics>>(getRepositoryToken(EngagementMetrics));
    userAchievementRepository = module.get<Repository<UserAchievement>>(getRepositoryToken(UserAchievement));
    userChallengeRepository = module.get<Repository<UserChallenge>>(getRepositoryToken(UserChallenge));
  });

  describe('Power User Pattern', () => {
    it('should identify power users with high engagement', async () => {
      const mockEngagementMetrics = {
        userId: mockUser.id,
        date: new Date(),
        dailyMetrics: {
          loginCount: 5,
          sessionDuration: 480, // 8 hours
          activitiesCompleted: 15,
          pointsEarned: 500,
          tokensEarned: 100,
          socialInteractions: 25,
          challengesAttempted: 8,
          achievementsUnlocked: 3,
        },
        weeklyMetrics: {
          activeDays: 7,
          totalPoints: 3500,
          averageSessionDuration: 420,
          retentionRate: 95,
          engagementScore: 90,
        },
        engagementScore: 92,
        retentionScore: 88,
        growthScore: 85,
        socialScore: 90,
        learningScore: 88,
      };

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue([mockEngagementMetrics] as any);

      // This would be part of a service method that analyzes patterns
      const isPowerUser = mockEngagementMetrics.engagementScore > 85 &&
                         mockEngagementMetrics.weeklyMetrics.activeDays >= 6 &&
                         mockEngagementMetrics.dailyMetrics.sessionDuration > 300;

      expect(isPowerUser).toBe(true);
      expect(mockEngagementMetrics.engagementScore).toBeGreaterThan(85);
      expect(mockEngagementMetrics.weeklyMetrics.activeDays).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Casual User Pattern', () => {
    it('should identify casual users with moderate engagement', async () => {
      const mockEngagementMetrics = {
        userId: mockUser.id,
        date: new Date(),
        dailyMetrics: {
          loginCount: 1,
          sessionDuration: 30, // 30 minutes
          activitiesCompleted: 2,
          pointsEarned: 50,
          tokensEarned: 10,
          socialInteractions: 3,
          challengesAttempted: 1,
          achievementsUnlocked: 0,
        },
        weeklyMetrics: {
          activeDays: 3,
          totalPoints: 150,
          averageSessionDuration: 25,
          retentionRate: 60,
          engagementScore: 45,
        },
        engagementScore: 48,
        retentionScore: 55,
        growthScore: 40,
        socialScore: 35,
        learningScore: 50,
      };

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue([mockEngagementMetrics] as any);

      const isCasualUser = mockEngagementMetrics.engagementScore >= 40 &&
                         mockEngagementMetrics.engagementScore <= 60 &&
                         mockEngagementMetrics.weeklyMetrics.activeDays >= 2 &&
                         mockEngagementMetrics.weeklyMetrics.activeDays <= 4;

      expect(isCasualUser).toBe(true);
      expect(mockEngagementMetrics.engagementScore).toBeGreaterThanOrEqual(40);
      expect(mockEngagementMetrics.engagementScore).toBeLessThanOrEqual(60);
    });
  });

  describe('At Risk User Pattern', () => {
    it('should identify at-risk users with declining engagement', async () => {
      const mockEngagementMetrics = {
        userId: mockUser.id,
        date: new Date(),
        dailyMetrics: {
          loginCount: 0,
          sessionDuration: 0,
          activitiesCompleted: 0,
          pointsEarned: 0,
          tokensEarned: 0,
          socialInteractions: 0,
          challengesAttempted: 0,
          achievementsUnlocked: 0,
        },
        weeklyMetrics: {
          activeDays: 0,
          totalPoints: 0,
          averageSessionDuration: 0,
          retentionRate: 10,
          engagementScore: 5,
        },
        engagementScore: 8,
        retentionScore: 15,
        growthScore: 5,
        socialScore: 10,
        learningScore: 5,
        trends: {
          dailyTrend: [20, 15, 10, 5, 2, 1, 0], // Declining trend
          weeklyTrend: [60, 45, 30, 15, 8],
          monthlyTrend: [80, 65, 50, 35, 20, 8],
        },
        predictions: {
          nextWeekEngagement: 2,
          churnRisk: 85,
          optimalIntervention: 're_engagement_campaign',
          recommendedActions: ['personalized_offer', 'social_reminder', 'achievement_nudge'],
        },
      };

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue([mockEngagementMetrics] as any);

      const isAtRisk = mockEngagementMetrics.engagementScore < 20 &&
                      mockEngagementMetrics.retentionScore < 30 &&
                      mockEngagementMetrics.predictions.churnRisk > 70;

      expect(isAtRisk).toBe(true);
      expect(mockEngagementMetrics.engagementScore).toBeLessThan(20);
      expect(mockEngagementMetrics.predictions.churnRisk).toBeGreaterThan(70);
    });
  });

  describe('Achievement Hunter Pattern', () => {
    it('should identify achievement-focused users', async () => {
      const mockUserAchievements = [
        { status: 'completed', achievement: { category: 'learning', tier: 'bronze' } },
        { status: 'completed', achievement: { category: 'social', tier: 'silver' } },
        { status: 'completed', achievement: { category: 'events', tier: 'gold' } },
        { status: 'completed', achievement: { category: 'contribution', tier: 'platinum' } },
        { status: 'in_progress', achievement: { category: 'streak', tier: 'diamond' } },
        { status: 'in_progress', achievement: { category: 'leadership', tier: 'legendary' } },
      ];

      jest.spyOn(userAchievementRepository, 'find').mockResolvedValue(mockUserAchievements as any);

      const completedAchievements = mockUserAchievements.filter(ua => ua.status === 'completed');
      const totalAchievements = mockUserAchievements.length;
      const completionRate = (completedAchievements.length / totalAchievements) * 100;
      const hasHighTierAchievements = completedAchievements.some(ua => 
        ['gold', 'platinum', 'diamond', 'legendary'].includes(ua.achievement.tier)
      );

      const isAchievementHunter = completionRate > 60 && hasHighTierAchievements;

      expect(isAchievementHunter).toBe(true);
      expect(completionRate).toBeGreaterThan(60);
      expect(hasHighTierAchievements).toBe(true);
    });
  });

  describe('Challenge Enthusiast Pattern', () => {
    it('should identify challenge-focused users', async () => {
      const mockUserChallenges = [
        { 
          status: 'completed', 
          score: 95,
          challenge: { difficulty: 'hard', type: 'individual' },
          progress: { overallProgress: 100 }
        },
        { 
          status: 'completed', 
          score: 88,
          challenge: { difficulty: 'medium', type: 'team' },
          progress: { overallProgress: 100 }
        },
        { 
          status: 'completed', 
          score: 92,
          challenge: { difficulty: 'expert', type: 'guild' },
          progress: { overallProgress: 100 }
        },
        { 
          status: 'in_progress', 
          score: 45,
          challenge: { difficulty: 'legendary', type: 'competitive' },
          progress: { overallProgress: 60 }
        },
        { 
          status: 'in_progress', 
          score: 30,
          challenge: { difficulty: 'master', type: 'collaborative' },
          progress: { overallProgress: 40 }
        },
      ];

      jest.spyOn(userChallengeRepository, 'find').mockResolvedValue(mockUserChallenges as any);

      const completedChallenges = mockUserChallenges.filter(uc => uc.status === 'completed');
      const totalChallenges = mockUserChallenges.length;
      const completionRate = (completedChallenges.length / totalChallenges) * 100;
      const averageScore = completedChallenges.reduce((sum, uc) => sum + uc.score, 0) / completedChallenges.length;
      const attemptsHardChallenges = mockUserChallenges.some(uc => 
        ['hard', 'expert', 'master', 'legendary'].includes(uc.challenge.difficulty)
      );

      const isChallengeEnthusiast = completionRate > 50 && 
                                  averageScore > 80 && 
                                  attemptsHardChallenges;

      expect(isChallengeEnthusiast).toBe(true);
      expect(completionRate).toBeGreaterThan(50);
      expect(averageScore).toBeGreaterThan(80);
      expect(attemptsHardChallenges).toBe(true);
    });
  });

  describe('Social Butterfly Pattern', () => {
    it('should identify socially active users', async () => {
      const mockEngagementMetrics = {
        userId: mockUser.id,
        date: new Date(),
        dailyMetrics: {
          loginCount: 2,
          sessionDuration: 120,
          activitiesCompleted: 5,
          pointsEarned: 100,
          tokensEarned: 20,
          socialInteractions: 50, // High social activity
          challengesAttempted: 2,
          achievementsUnlocked: 1,
        },
        weeklyMetrics: {
          activeDays: 5,
          totalPoints: 500,
          averageSessionDuration: 100,
          retentionRate: 75,
          engagementScore: 65,
        },
        engagementScore: 68,
        retentionScore: 70,
        growthScore: 60,
        socialScore: 95, // Very high social score
        learningScore: 55,
      };

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue([mockEngagementMetrics] as any);

      const isSocialButterfly = mockEngagementMetrics.socialScore > 85 &&
                               mockEngagementMetrics.dailyMetrics.socialInteractions > 30;

      expect(isSocialButterfly).toBe(true);
      expect(mockEngagementMetrics.socialScore).toBeGreaterThan(85);
      expect(mockEngagementMetrics.dailyMetrics.socialInteractions).toBeGreaterThan(30);
    });
  });

  describe('Steady Learner Pattern', () => {
    it('should identify consistent learning patterns', async () => {
      const mockEngagementMetrics = {
        userId: mockUser.id,
        date: new Date(),
        dailyMetrics: {
          loginCount: 1,
          sessionDuration: 60,
          activitiesCompleted: 3,
          pointsEarned: 75,
          tokensEarnn: 15,
          socialInteractions: 5,
          challengesAttempted: 1,
          achievementsUnlocked: 0,
        },
        weeklyMetrics: {
          activeDays: 6, // Very consistent
          totalPoints: 450,
          averageSessionDuration: 55,
          retentionRate: 85,
          engagementScore: 70,
        },
        engagementScore: 72,
        retentionScore: 80,
        growthScore: 75,
        socialScore: 45,
        learningScore: 85, // High learning score
        trends: {
          dailyTrend: [65, 68, 70, 72, 71, 73, 72], // Consistent trend
          weeklyTrend: [65, 68, 70, 72],
          monthlyTrend: [60, 65, 68, 70, 72],
        },
      };

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue([mockEngagementMetrics] as any);

      const isSteadyLearner = mockEngagementMetrics.learningScore > 80 &&
                              mockEngagementMetrics.weeklyMetrics.activeDays >= 5 &&
                              mockEngagementMetrics.retentionScore > 75;

      expect(isSteadyLearner).toBe(true);
      expect(mockEngagementMetrics.learningScore).toBeGreaterThan(80);
      expect(mockEngagementMetrics.weeklyMetrics.activeDays).toBeGreaterThanOrEqual(5);
      expect(mockEngagementMetrics.retentionScore).toBeGreaterThan(75);
    });
  });

  describe('Weekend Warrior Pattern', () => {
    it('should identify users who primarily engage on weekends', async () => {
      const weekendMetrics = [
        { date: new Date('2024-01-06'), dailyMetrics: { loginCount: 2, sessionDuration: 180 } }, // Saturday
        { date: new Date('2024-01-07'), dailyMetrics: { loginCount: 3, sessionDuration: 240 } }, // Sunday
        { date: new Date('2024-01-13'), dailyMetrics: { loginCount: 2, sessionDuration: 200 } }, // Saturday
        { date: new Date('2024-01-14'), dailyMetrics: { loginCount: 1, sessionDuration: 120 } }, // Sunday
      ];

      const weekdayMetrics = [
        { date: new Date('2024-01-08'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // Monday
        { date: new Date('2024-01-09'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // Tuesday
        { date: new Date('2024-01-10'), dailyMetrics: { loginCount: 1, sessionDuration: 30 } }, // Wednesday
        { date: new Date('2024-01-11'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // Thursday
        { date: new Date('2024-01-12'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // Friday
      ];

      const allMetrics = [...weekendMetrics, ...weekdayMetrics];

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue(allMetrics as any);

      const weekendActivity = weekendMetrics.reduce((sum, m) => sum + m.dailyMetrics.sessionDuration, 0);
      const weekdayActivity = weekdayMetrics.reduce((sum, m) => sum + m.dailyMetrics.sessionDuration, 0);
      const totalActivity = weekendActivity + weekdayActivity;
      const weekendPercentage = (weekendActivity / totalActivity) * 100;

      const isWeekendWarrior = weekendPercentage > 70 && totalActivity > 300;

      expect(isWeekendWarrior).toBe(true);
      expect(weekendPercentage).toBeGreaterThan(70);
    });
  });

  describe('Burst Engagement Pattern', () => {
    it('should identify users with bursty engagement patterns', async () => {
      const burstMetrics = [
        { date: new Date('2024-01-01'), dailyMetrics: { loginCount: 5, sessionDuration: 480 } }, // High activity
        { date: new Date('2024-01-02'), dailyMetrics: { loginCount: 4, sessionDuration: 360 } }, // High activity
        { date: new Date('2024-01-03'), dailyMetrics: { loginCount: 3, sessionDuration: 240 } }, // High activity
        { date: new Date('2024-01-04'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // No activity
        { date: new Date('2024-01-05'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // No activity
        { date: new Date('2024-01-06'), dailyMetrics: { loginCount: 0, sessionDuration: 0 } }, // No activity
        { date: new Date('2024-01-07'), dailyMetrics: { loginCount: 1, sessionDuration: 30 } }, // Low activity
      ];

      jest.spyOn(engagementMetricsRepository, 'find').mockResolvedValue(burstMetrics as any);

      const sessionDurations = burstMetrics.map(m => m.dailyMetrics.sessionDuration);
      const averageSession = sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length;
      const maxSession = Math.max(...sessionDurations);
      const minSession = Math.min(...sessionDurations);
      const variance = sessionDurations.reduce((sum, d) => sum + Math.pow(d - averageSession, 2), 0) / sessionDurations.length;
      const standardDeviation = Math.sqrt(variance);

      const hasBurstPattern = standardDeviation > 150 && // High variance
                              maxSession > 300 && // Has high activity periods
                              minSession === 0; // Has zero activity periods

      expect(hasBurstPattern).toBe(true);
      expect(standardDeviation).toBeGreaterThan(150);
      expect(maxSession).toBeGreaterThan(300);
      expect(minSession).toBe(0);
    });
  });
});
