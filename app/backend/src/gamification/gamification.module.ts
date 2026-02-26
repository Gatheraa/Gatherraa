import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { Leaderboard } from './entities/leaderboard.entity';
import { LeaderboardEntry } from './entities/leaderboard.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/challenge.entity';
import { Streak } from './entities/streak.entity';
import { StreakActivity } from './entities/streak.entity';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild.entity';
import { GuildChallenge } from './entities/guild.entity';
import { SeasonalEvent } from './entities/seasonal-event.entity';
import { UserEventParticipation } from './entities/seasonal-event.entity';
import { GamificationAnalytics } from './entities/gamification-analytics.entity';
import { EngagementMetrics } from './entities/gamification-analytics.entity';
import { GamificationInsurance } from './entities/gamification-analytics.entity';
import { GamificationService } from './services/gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      UserAchievement,
      Leaderboard,
      LeaderboardEntry,
      Challenge,
      UserChallenge,
      Streak,
      StreakActivity,
      Guild,
      GuildMember,
      GuildChallenge,
      SeasonalEvent,
      UserEventParticipation,
      GamificationAnalytics,
      EngagementMetrics,
      GamificationInsurance,
    ]),
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
