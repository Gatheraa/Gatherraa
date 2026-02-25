import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamificationService } from '../services/gamification.service';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { Leaderboard } from '../entities/leaderboard.entity';
import { LeaderboardEntry } from '../entities/leaderboard.entity';
import { Challenge } from '../entities/challenge.entity';
import { UserChallenge } from '../entities/challenge.entity';
import { Streak } from '../entities/streak.entity';
import { Guild } from '../entities/guild.entity';
import { GuildMember } from '../entities/guild.entity';

describe('GamificationService', () => {
  let service: GamificationService;
  let achievementRepository: Repository<Achievement>;
  let userAchievementRepository: Repository<UserAchievement>;
  let leaderboardRepository: Repository<Leaderboard>;
  let leaderboardEntryRepository: Repository<LeaderboardEntry>;
  let challengeRepository: Repository<Challenge>;
  let userChallengeRepository: Repository<UserChallenge>;
  let streakRepository: Repository<Streak>;
  let guildRepository: Repository<Guild>;
  let guildMemberRepository: Repository<GuildMember>;

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: getRepositoryToken(Achievement),
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
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Leaderboard),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LeaderboardEntry),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Challenge),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserChallenge),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Streak),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Guild),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GuildMember),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    achievementRepository = module.get<Repository<Achievement>>(getRepositoryToken(Achievement));
    userAchievementRepository = module.get<Repository<UserAchievement>>(getRepositoryToken(UserAchievement));
    leaderboardRepository = module.get<Repository<Leaderboard>>(getRepositoryToken(Leaderboard));
    leaderboardEntryRepository = module.get<Repository<LeaderboardEntry>>(getRepositoryToken(LeaderboardEntry));
    challengeRepository = module.get<Repository<Challenge>>(getRepositoryToken(Challenge));
    userChallengeRepository = module.get<Repository<UserChallenge>>(getRepositoryToken(UserChallenge));
    streakRepository = module.get<Repository<Streak>>(getRepositoryToken(Streak));
    guildRepository = module.get<Repository<Guild>>(getRepositoryToken(Guild));
    guildMemberRepository = module.get<Repository<GuildMember>>(getRepositoryToken(GuildMember));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Achievement System', () => {
    it('should create a new achievement', async () => {
      const achievementData = {
        name: 'First Steps',
        description: 'Complete your first activity',
        category: 'learning',
        tier: 'bronze',
        points: 10,
        criteria: {
          type: 'cumulative',
          target: 1,
        },
      };

      const expectedAchievement = { id: 'achievement-123', ...achievementData };
      jest.spyOn(achievementRepository, 'create').mockReturnValue(expectedAchievement as any);
      jest.spyOn(achievementRepository, 'save').mockResolvedValue(expectedAchievement as any);

      const result = await service.createAchievement(achievementData);

      expect(achievementRepository.create).toHaveBeenCalledWith(achievementData);
      expect(achievementRepository.save).toHaveBeenCalledWith(expectedAchievement);
      expect(result).toEqual(expectedAchievement);
    });

    it('should update achievement progress and mark as completed', async () => {
      const achievementId = 'achievement-123';
      const progress = 5;
      const target = 5;

      const mockAchievement = {
        id: achievementId,
        criteria: { target },
        rewards: [{ type: 'points', value: 100 }],
      };

      const mockUserAchievement = {
        userId: mockUser.id,
        achievementId,
        status: 'in_progress',
        progress: {
          current: 0,
          target,
          percentage: 0,
          lastUpdated: new Date(),
        },
      };

      jest.spyOn(achievementRepository, 'findOne').mockResolvedValue(mockAchievement as any);
      jest.spyOn(userAchievementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userAchievementRepository, 'create').mockReturnValue(mockUserAchievement as any);
      jest.spyOn(userAchievementRepository, 'save').mockResolvedValue({
        ...mockUserAchievement,
        status: 'completed',
        progress: {
          current: progress,
          target,
          percentage: 100,
          lastUpdated: new Date(),
        },
        completedAt: new Date(),
      } as any);

      const result = await service.updateAchievementProgress(mockUser.id, achievementId, progress);

      expect(result.status).toBe('completed');
      expect(result.progress.current).toBe(progress);
      expect(result.progress.percentage).toBe(100);
    });

    it('should get user achievements', async () => {
      const mockUserAchievements = [
        {
          id: 'ua-1',
          userId: mockUser.id,
          achievement: { id: 'a-1', name: 'Achievement 1' },
          status: 'completed',
        },
        {
          id: 'ua-2',
          userId: mockUser.id,
          achievement: { id: 'a-2', name: 'Achievement 2' },
          status: 'in_progress',
        },
      ];

      jest.spyOn(userAchievementRepository, 'find').mockResolvedValue(mockUserAchievements as any);

      const result = await service.getUserAchievements(mockUser.id);

      expect(userAchievementRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        relations: ['achievement'],
      });
      expect(result).toEqual(mockUserAchievements);
    });
  });

  describe('Leaderboard System', () => {
    it('should create a new leaderboard', async () => {
      const leaderboardData = {
        name: 'Weekly Points',
        description: 'Top points earners this week',
        type: 'points',
        period: 'weekly',
        criteria: {
          metric: 'points',
          algorithm: 'sum',
        },
      };

      const expectedLeaderboard = { id: 'leaderboard-123', ...leaderboardData };
      jest.spyOn(leaderboardRepository, 'create').mockReturnValue(expectedLeaderboard as any);
      jest.spyOn(leaderboardRepository, 'save').mockResolvedValue(expectedLeaderboard as any);

      const result = await service.createLeaderboard(leaderboardData);

      expect(leaderboardRepository.create).toHaveBeenCalledWith(leaderboardData);
      expect(leaderboardRepository.save).toHaveBeenCalledWith(expectedLeaderboard);
      expect(result).toEqual(expectedLeaderboard);
    });

    it('should get leaderboard entries', async () => {
      const leaderboardId = 'leaderboard-123';
      const mockEntries = [
        {
          id: 'entry-1',
          leaderboardId,
          userId: 'user-1',
          rank: 1,
          score: 1000,
          user: mockUser,
        },
        {
          id: 'entry-2',
          leaderboardId,
          userId: 'user-2',
          rank: 2,
          score: 800,
          user: { ...mockUser, id: 'user-2', firstName: 'Jane' },
        },
      ];

      jest.spyOn(leaderboardEntryRepository, 'find').mockResolvedValue(mockEntries as any);

      const result = await service.getLeaderboard(leaderboardId, 100);

      expect(leaderboardEntryRepository.find).toHaveBeenCalledWith({
        where: { leaderboardId },
        relations: ['user'],
        order: { rank: 'ASC' },
        take: 100,
      });
      expect(result).toEqual(mockEntries);
    });

    it('should update user leaderboard score', async () => {
      const leaderboardId = 'leaderboard-123';
      const score = 1500;
      const breakdown = { points: 1000, challenges: 300, social: 200 };

      const mockEntry = {
        userId: mockUser.id,
        leaderboardId,
        score,
        breakdown,
        rank: 0,
      };

      jest.spyOn(leaderboardEntryRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(leaderboardEntryRepository, 'create').mockReturnValue(mockEntry as any);
      jest.spyOn(leaderboardEntryRepository, 'save').mockResolvedValue(mockEntry as any);
      jest.spyOn(service as any, 'recalculateLeaderboardRanks').mockResolvedValue(undefined);

      const result = await service.updateUserLeaderboardScore(mockUser.id, leaderboardId, score, breakdown);

      expect(leaderboardEntryRepository.create).toHaveBeenCalled();
      expect(leaderboardEntryRepository.save).toHaveBeenCalledWith(mockEntry);
      expect(result).toEqual(mockEntry);
    });
  });

  describe('Challenge System', () => {
    it('should create a new challenge', async () => {
      const challengeData = {
        title: 'Learn React Basics',
        description: 'Complete the React fundamentals course',
        type: 'individual',
        difficulty: 'easy',
        objectives: [
          {
            id: 'obj-1',
            description: 'Complete module 1',
            target: 1,
            points: 50,
            order: 1,
            isRequired: true,
          },
        ],
        rewards: {
          points: 100,
          tokens: 50,
        },
      };

      const expectedChallenge = { id: 'challenge-123', ...challengeData };
      jest.spyOn(challengeRepository, 'create').mockReturnValue(expectedChallenge as any);
      jest.spyOn(challengeRepository, 'save').mockResolvedValue(expectedChallenge as any);

      const result = await service.createChallenge(challengeData);

      expect(challengeRepository.create).toHaveBeenCalledWith(challengeData);
      expect(challengeRepository.save).toHaveBeenCalledWith(expectedChallenge);
      expect(result).toEqual(expectedChallenge);
    });

    it('should enroll user in challenge', async () => {
      const challengeId = 'challenge-123';
      const mockUserChallenge = {
        userId: mockUser.id,
        challengeId,
        status: 'not_started',
        progress: {
          currentStep: 0,
          completedObjectives: [],
          overallProgress: 0,
          timeSpent: 0,
          lastActivity: new Date(),
        },
      };

      jest.spyOn(userChallengeRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userChallengeRepository, 'create').mockReturnValue(mockUserChallenge as any);
      jest.spyOn(userChallengeRepository, 'save').mockResolvedValue(mockUserChallenge as any);

      const result = await service.enrollUserInChallenge(mockUser.id, challengeId);

      expect(userChallengeRepository.create).toHaveBeenCalled();
      expect(userChallengeRepository.save).toHaveBeenCalledWith(mockUserChallenge);
      expect(result).toEqual(mockUserChallenge);
    });

    it('should update challenge progress', async () => {
      const challengeId = 'challenge-123';
      const objectiveId = 'obj-1';
      const progress = 1;

      const mockChallenge = {
        id: challengeId,
        objectives: [
          {
            id: objectiveId,
            target: 1,
          },
        ],
      };

      const mockUserChallenge = {
        userId: mockUser.id,
        challengeId,
        status: 'in_progress',
        progress: {
          currentStep: 0,
          completedObjectives: [],
          overallProgress: 0,
          timeSpent: 0,
          lastActivity: new Date(),
        },
        objectiveProgress: {},
      };

      jest.spyOn(userChallengeRepository, 'findOne').mockResolvedValue(mockUserChallenge as any);
      jest.spyOn(userChallengeRepository, 'save').mockResolvedValue({
        ...mockUserChallenge,
        progress: {
          ...mockUserChallenge.progress,
          completedObjectives: [objectiveId],
          overallProgress: 100,
        },
        status: 'completed',
        completedAt: new Date(),
      } as any);

      const result = await service.updateChallengeProgress(mockUser.id, challengeId, objectiveId, progress);

      expect(result.status).toBe('completed');
      expect(result.progress.overallProgress).toBe(100);
    });
  });

  describe('Streak System', () => {
    it('should create a new streak', async () => {
      const streakData = {
        userId: mockUser.id,
        name: 'Daily Login',
        type: 'daily_login',
        criteria: {
          action: 'login',
          frequency: 'daily',
          requiredCount: 1,
        },
        currentStreak: 0,
        longestStreak: 0,
      };

      const expectedStreak = { id: 'streak-123', ...streakData };
      jest.spyOn(streakRepository, 'create').mockReturnValue(expectedStreak as any);
      jest.spyOn(streakRepository, 'save').mockResolvedValue(expectedStreak as any);

      const result = await service.createStreak(streakData);

      expect(streakRepository.create).toHaveBeenCalledWith(streakData);
      expect(streakRepository.save).toHaveBeenCalledWith(expectedStreak);
      expect(result).toEqual(expectedStreak);
    });

    it('should update streak activity', async () => {
      const streakId = 'streak-123';
      const activity = { type: 'login', timestamp: new Date() };

      const mockStreak = {
        userId: mockUser.id,
        id: streakId,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      const updatedStreak = {
        ...mockStreak,
        currentStreak: 6,
        longestStreak: 10,
        lastActivityDate: new Date(),
      };

      jest.spyOn(streakRepository, 'findOne').mockResolvedValue(mockStreak as any);
      jest.spyOn(streakRepository, 'save').mockResolvedValue(updatedStreak as any);
      jest.spyOn(service as any, 'streakActivityRepository', 'findOne').mockResolvedValue(null);
      jest.spyOn(service as any, 'streakActivityRepository', 'save').mockResolvedValue({} as any);

      const result = await service.updateStreakActivity(mockUser.id, streakId, activity);

      expect(result.currentStreak).toBe(6);
      expect(streakRepository.save).toHaveBeenCalled();
    });
  });

  describe('Guild System', () => {
    it('should create a new guild', async () => {
      const guildData = {
        name: 'Code Masters',
        description: 'A guild for coding enthusiasts',
        tag: 'CODE',
        type: 'learning',
        leaderId: mockUser.id,
      };

      const expectedGuild = { id: 'guild-123', ...guildData };
      jest.spyOn(guildRepository, 'create').mockReturnValue(expectedGuild as any);
      jest.spyOn(guildRepository, 'save').mockResolvedValue(expectedGuild as any);

      const result = await service.createGuild(guildData);

      expect(guildRepository.create).toHaveBeenCalledWith(guildData);
      expect(guildRepository.save).toHaveBeenCalledWith(expectedGuild);
      expect(result).toEqual(expectedGuild);
    });

    it('should join guild', async () => {
      const guildId = 'guild-123';
      const mockGuildMember = {
        userId: mockUser.id,
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
      };

      jest.spyOn(guildMemberRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(guildMemberRepository, 'create').mockReturnValue(mockGuildMember as any);
      jest.spyOn(guildMemberRepository, 'save').mockResolvedValue(mockGuildMember as any);

      const result = await service.joinGuild(mockUser.id, guildId);

      expect(guildMemberRepository.create).toHaveBeenCalled();
      expect(guildMemberRepository.save).toHaveBeenCalledWith(mockGuildMember);
      expect(result).toEqual(mockGuildMember);
    });
  });

  describe('Adaptive Difficulty', () => {
    it('should calculate adaptive difficulty based on performance', async () => {
      const baseDifficulty = 0.5;
      const mockUserChallenges = [
        { score: 90, status: 'completed' },
        { score: 85, status: 'completed' },
        { score: 88, status: 'completed' },
        { score: 92, status: 'completed' },
        { score: 87, status: 'completed' },
      ];

      jest.spyOn(userChallengeRepository, 'find').mockResolvedValue(mockUserChallenges as any);

      const result = await service.calculateAdaptiveDifficulty(mockUser.id, baseDifficulty);

      expect(result).toBeGreaterThan(baseDifficulty); // Should increase due to high performance
      expect(result).toBeLessThanOrEqual(1.0); // Should not exceed max
    });

    it('should decrease difficulty for poor performance', async () => {
      const baseDifficulty = 0.5;
      const mockUserChallenges = [
        { score: 30, status: 'completed' },
        { score: 25, status: 'completed' },
        { score: 35, status: 'completed' },
        { score: 40, status: 'completed' },
        { score: 28, status: 'completed' },
      ];

      jest.spyOn(userChallengeRepository, 'find').mockResolvedValue(mockUserChallenges as any);

      const result = await service.calculateAdaptiveDifficulty(mockUser.id, baseDifficulty);

      expect(result).toBeLessThan(baseDifficulty); // Should decrease due to low performance
      expect(result).toBeGreaterThanOrEqual(0.1); // Should not go below min
    });
  });

  describe('Personalization', () => {
    it('should get personalized recommendations', async () => {
      const mockUserAchievements = [
        {
          status: 'completed',
          achievement: { category: 'learning', tier: 'bronze' },
        },
        {
          status: 'completed',
          achievement: { category: 'learning', tier: 'silver' },
        },
      ];

      const mockUserChallenges = [
        {
          challenge: { difficulty: 'easy' },
        },
        {
          challenge: { difficulty: 'easy' },
        },
        {
          challenge: { difficulty: 'medium' },
        },
      ];

      const mockSuggestedChallenges = [
        { id: 'c-1', difficulty: 'easy', isActive: true },
        { id: 'c-2', difficulty: 'easy', isActive: true },
      ];

      jest.spyOn(service, 'getUserAchievements').mockResolvedValue(mockUserAchievements as any);
      jest.spyOn(userChallengeRepository, 'find').mockResolvedValue(mockUserChallenges as any);
      jest.spyOn(challengeRepository, 'find').mockResolvedValue(mockSuggestedChallenges as any);

      const result = await service.getPersonalizedRecommendations(mockUser.id);

      expect(result).toContainEqual(mockSuggestedChallenges[0]);
      expect(result).toContainEqual(mockSuggestedChallenges[1]);
    });
  });
});
