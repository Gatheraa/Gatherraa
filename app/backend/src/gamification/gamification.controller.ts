import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GamificationService } from './services/gamification.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { Leaderboard } from './entities/leaderboard.entity';
import { LeaderboardEntry } from './entities/leaderboard.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/challenge.entity';
import { Streak } from './entities/streak.entity';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild.entity';
import { SeasonalEvent } from './entities/seasonal-event.entity';

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // Achievement Endpoints
  @Post('achievements')
  @ApiOperation({ summary: 'Create a new achievement' })
  @ApiResponse({ status: 201, description: 'Achievement created successfully', type: Achievement })
  async createAchievement(@Body() achievementData: Partial<Achievement>): Promise<Achievement> {
    return await this.gamificationService.createAchievement(achievementData);
  }

  @Get('achievements/user')
  @ApiOperation({ summary: 'Get user achievements' })
  @ApiResponse({ status: 200, description: 'User achievements retrieved', type: [UserAchievement] })
  async getUserAchievements(@Request() req): Promise<UserAchievement[]> {
    return await this.gamificationService.getUserAchievements(req.user.id);
  }

  @Put('achievements/:achievementId/progress')
  @ApiOperation({ summary: 'Update achievement progress' })
  @ApiResponse({ status: 200, description: 'Achievement progress updated', type: UserAchievement })
  async updateAchievementProgress(
    @Request() req,
    @Param('achievementId') achievementId: string,
    @Body() body: { progress: number; evidence?: any },
  ): Promise<UserAchievement> {
    return await this.gamificationService.updateAchievementProgress(
      req.user.id,
      achievementId,
      body.progress,
      body.evidence,
    );
  }

  // Leaderboard Endpoints
  @Post('leaderboards')
  @ApiOperation({ summary: 'Create a new leaderboard' })
  @ApiResponse({ status: 201, description: 'Leaderboard created successfully', type: Leaderboard })
  async createLeaderboard(@Body() leaderboardData: Partial<Leaderboard>): Promise<Leaderboard> {
    return await this.gamificationService.createLeaderboard(leaderboardData);
  }

  @Get('leaderboards/:leaderboardId')
  @ApiOperation({ summary: 'Get leaderboard entries' })
  @ApiResponse({ status: 200, description: 'Leaderboard entries retrieved', type: [LeaderboardEntry] })
  async getLeaderboard(
    @Param('leaderboardId') leaderboardId: string,
    @Query('limit') limit = 100,
  ): Promise<LeaderboardEntry[]> {
    return await this.gamificationService.getLeaderboard(leaderboardId, parseInt(limit.toString()));
  }

  @Put('leaderboards/:leaderboardId/score')
  @ApiOperation({ summary: 'Update user leaderboard score' })
  @ApiResponse({ status: 200, description: 'Leaderboard score updated', type: LeaderboardEntry })
  async updateLeaderboardScore(
    @Request() req,
    @Param('leaderboardId') leaderboardId: string,
    @Body() body: { score: number; breakdown: Record<string, number> },
  ): Promise<LeaderboardEntry> {
    return await this.gamificationService.updateUserLeaderboardScore(
      req.user.id,
      leaderboardId,
      body.score,
      body.breakdown,
    );
  }

  // Challenge Endpoints
  @Post('challenges')
  @ApiOperation({ summary: 'Create a new challenge' })
  @ApiResponse({ status: 201, description: 'Challenge created successfully', type: Challenge })
  async createChallenge(@Body() challengeData: Partial<Challenge>): Promise<Challenge> {
    return await this.gamificationService.createChallenge(challengeData);
  }

  @Post('challenges/:challengeId/enroll')
  @ApiOperation({ summary: 'Enroll user in challenge' })
  @ApiResponse({ status: 201, description: 'User enrolled in challenge', type: UserChallenge })
  async enrollInChallenge(
    @Request() req,
    @Param('challengeId') challengeId: string,
  ): Promise<UserChallenge> {
    return await this.gamificationService.enrollUserInChallenge(req.user.id, challengeId);
  }

  @Put('challenges/:challengeId/progress')
  @ApiOperation({ summary: 'Update challenge progress' })
  @ApiResponse({ status: 200, description: 'Challenge progress updated', type: UserChallenge })
  async updateChallengeProgress(
    @Request() req,
    @Param('challengeId') challengeId: string,
    @Body() body: { objectiveId: string; progress: number },
  ): Promise<UserChallenge> {
    return await this.gamificationService.updateChallengeProgress(
      req.user.id,
      challengeId,
      body.objectiveId,
      body.progress,
    );
  }

  // Streak Endpoints
  @Post('streaks')
  @ApiOperation({ summary: 'Create a new streak' })
  @ApiResponse({ status: 201, description: 'Streak created successfully', type: Streak })
  async createStreak(@Body() streakData: Partial<Streak>): Promise<Streak> {
    return await this.gamificationService.createStreak(streakData);
  }

  @Put('streaks/:streakId/activity')
  @ApiOperation({ summary: 'Update streak activity' })
  @ApiResponse({ status: 200, description: 'Streak activity updated', type: Streak })
  async updateStreakActivity(
    @Request() req,
    @Param('streakId') streakId: string,
    @Body() body: { activity: any },
  ): Promise<Streak> {
    return await this.gamificationService.updateStreakActivity(req.user.id, streakId, body.activity);
  }

  // Guild Endpoints
  @Post('guilds')
  @ApiOperation({ summary: 'Create a new guild' })
  @ApiResponse({ status: 201, description: 'Guild created successfully', type: Guild })
  async createGuild(@Body() guildData: Partial<Guild>): Promise<Guild> {
    return await this.gamificationService.createGuild(guildData);
  }

  @Post('guilds/:guildId/join')
  @ApiOperation({ summary: 'Join a guild' })
  @ApiResponse({ status: 201, description: 'User joined guild', type: GuildMember })
  async joinGuild(
    @Request() req,
    @Param('guildId') guildId: string,
  ): Promise<GuildMember> {
    return await this.gamificationService.joinGuild(req.user.id, guildId);
  }

  // Personalization Endpoints
  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized recommendations' })
  @ApiResponse({ status: 200, description: 'Personalized recommendations retrieved' })
  async getRecommendations(@Request() req): Promise<any[]> {
    return await this.gamificationService.getPersonalizedRecommendations(req.user.id);
  }

  @Get('adaptive-difficulty/:baseDifficulty')
  @ApiOperation({ summary: 'Calculate adaptive difficulty' })
  @ApiResponse({ status: 200, description: 'Adaptive difficulty calculated' })
  async getAdaptiveDifficulty(
    @Request() req,
    @Param('baseDifficulty') baseDifficulty: number,
  ): Promise<{ difficulty: number }> {
    const difficulty = await this.gamificationService.calculateAdaptiveDifficulty(
      req.user.id,
      parseFloat(baseDifficulty),
    );
    return { difficulty };
  }

  // Analytics Endpoints
  @Post('analytics/track')
  @ApiOperation({ summary: 'Track analytics event' })
  @ApiResponse({ status: 201, description: 'Analytics event tracked' })
  async trackAnalytics(
    @Request() req,
    @Body() body: { eventType: string; data: any },
  ): Promise<{ message: string }> {
    await this.gamificationService.trackAnalytics(req.user.id, body.eventType, body.data);
    return { message: 'Analytics event tracked successfully' };
  }
}
