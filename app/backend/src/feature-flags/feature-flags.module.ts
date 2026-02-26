import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FlagEvaluation } from './entities/flag-evaluation.entity';
import { FlagEvaluationService } from './services/flag-evaluation.service';
import { FlagCacheService } from './services/flag-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag, FlagEvaluation])],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FlagEvaluationService, FlagCacheService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
