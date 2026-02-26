import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, FlagStatus } from './entities/feature-flag.entity';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto, EvaluateFlagDto, BulkEvaluateFlagsDto } from './dto/create-feature-flag.dto';
import { FlagEvaluationService, EvaluationContext, EvaluationResult } from './services/flag-evaluation.service';
import { FlagCacheService } from './services/flag-cache.service';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private featureFlagRepository: Repository<FeatureFlag>,
    private flagEvaluationService: FlagEvaluationService,
    private flagCacheService: FlagCacheService,
  ) {}

  /**
   * Create a new feature flag
   */
  async create(createDto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findOne({
      where: { key: createDto.key },
    });

    if (existing) {
      throw new ConflictException(`Feature flag with key "${createDto.key}" already exists`);
    }

    const flag = this.featureFlagRepository.create(createDto);
    const saved = await this.featureFlagRepository.save(flag);

    // Cache the flag
    await this.flagCacheService.setFlag(saved);
    await this.flagCacheService.publishFlagUpdate(saved.key);

    this.logger.log(`Created feature flag: ${saved.key}`);
    return saved;
  }

  /**
   * Get all feature flags
   */
  async findAll(environment?: string): Promise<FeatureFlag[]> {
    const query = this.featureFlagRepository.createQueryBuilder('flag');

    if (environment) {
      query.where('flag.environment = :environment', { environment });
    }

    query.andWhere('flag.archivedAt IS NULL');

    return query.getMany();
  }

  /**
   * Get feature flag by key
   */
  async findByKey(key: string): Promise<FeatureFlag> {
    // Try cache first
    const cached = await this.flagCacheService.getFlag(key);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const flag = await this.featureFlagRepository.findOne({
      where: { key },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag with key "${key}" not found`);
    }

    // Cache it
    await this.flagCacheService.setFlag(flag);

    return flag;
  }

  /**
   * Update feature flag
   */
  async update(key: string, updateDto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    const flag = await this.findByKey(key);

    Object.assign(flag, updateDto);
    const updated = await this.featureFlagRepository.save(flag);

    // Update cache and notify
    await this.flagCacheService.setFlag(updated);
    await this.flagCacheService.publishFlagUpdate(updated.key);

    this.logger.log(`Updated feature flag: ${updated.key}`);
    return updated;
  }

  /**
   * Delete (archive) feature flag
   */
  async remove(key: string): Promise<void> {
    const flag = await this.findByKey(key);

    flag.status = FlagStatus.ARCHIVED;
    flag.archivedAt = new Date();
    await this.featureFlagRepository.save(flag);

    // Remove from cache
    await this.flagCacheService.deleteFlag(key);
    await this.flagCacheService.publishFlagUpdate(key);

    this.logger.log(`Archived feature flag: ${key}`);
  }

  /**
   * Evaluate a single flag for a user
   */
  async evaluateFlag(evaluateDto: EvaluateFlagDto): Promise<EvaluationResult> {
    try {
      const flag = await this.findByKey(evaluateDto.flagKey);

      const context: EvaluationContext = {
        userId: evaluateDto.userId,
        userAttributes: evaluateDto.context,
      };

      return await this.flagEvaluationService.evaluateFlag(flag, context);
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Return default value if flag doesn't exist
        return {
          value: evaluateDto.defaultValue ?? false,
          reason: 'flag_not_found',
          flagKey: evaluateDto.flagKey,
        };
      }
      throw error;
    }
  }

  /**
   * Evaluate multiple flags at once
   */
  async bulkEvaluate(bulkDto: BulkEvaluateFlagsDto): Promise<Record<string, EvaluationResult>> {
    const results: Record<string, EvaluationResult> = {};

    for (const flagKey of bulkDto.flagKeys) {
      try {
        results[flagKey] = await this.evaluateFlag({
          flagKey,
          userId: bulkDto.userId,
          context: bulkDto.context,
        });
      } catch (error) {
        this.logger.error(`Error evaluating flag ${flagKey}: ${error.message}`);
        results[flagKey] = {
          value: false,
          reason: 'evaluation_error',
          flagKey,
        };
      }
    }

    return results;
  }

  /**
   * Toggle flag status (activate/deactivate)
   */
  async toggleStatus(key: string): Promise<FeatureFlag> {
    const flag = await this.findByKey(key);

    flag.status = flag.status === FlagStatus.ACTIVE ? FlagStatus.INACTIVE : FlagStatus.ACTIVE;
    const updated = await this.featureFlagRepository.save(flag);

    // Update cache and notify
    await this.flagCacheService.setFlag(updated);
    await this.flagCacheService.publishFlagUpdate(updated.key);

    this.logger.log(`Toggled flag status: ${updated.key} -> ${updated.status}`);
    return updated;
  }

  /**
   * Emergency kill switch - immediately disable a flag
   */
  async killSwitch(key: string, reason?: string): Promise<FeatureFlag> {
    const flag = await this.findByKey(key);

    flag.status = FlagStatus.INACTIVE;
    flag.defaultValue = false;
    flag.metadata = {
      ...flag.metadata,
      killSwitchActivated: true,
      killSwitchReason: reason,
      killSwitchTimestamp: new Date().toISOString(),
    };

    const updated = await this.featureFlagRepository.save(flag);

    // Immediately update cache and notify all instances
    await this.flagCacheService.setFlag(updated);
    await this.flagCacheService.publishFlagUpdate(updated.key);

    this.logger.warn(`KILL SWITCH ACTIVATED for flag: ${updated.key}. Reason: ${reason}`);
    return updated;
  }

  /**
   * Get flag analytics
   */
  async getAnalytics(key: string, startDate?: Date, endDate?: Date) {
    await this.findByKey(key); // Verify flag exists
    return this.flagEvaluationService.getFlagAnalytics(key, startDate, endDate);
  }

  /**
   * Add user to whitelist
   */
  async addToWhitelist(key: string, userId: string): Promise<FeatureFlag> {
    const flag = await this.findByKey(key);

    if (!flag.whitelist) {
      flag.whitelist = [];
    }

    if (!flag.whitelist.includes(userId)) {
      flag.whitelist.push(userId);
      const updated = await this.featureFlagRepository.save(flag);

      await this.flagCacheService.setFlag(updated);
      await this.flagCacheService.publishFlagUpdate(updated.key);

      return updated;
    }

    return flag;
  }

  /**
   * Remove user from whitelist
   */
  async removeFromWhitelist(key: string, userId: string): Promise<FeatureFlag> {
    const flag = await this.findByKey(key);

    if (flag.whitelist) {
      flag.whitelist = flag.whitelist.filter((id) => id !== userId);
      const updated = await this.featureFlagRepository.save(flag);

      await this.flagCacheService.setFlag(updated);
      await this.flagCacheService.publishFlagUpdate(updated.key);

      return updated;
    }

    return flag;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return this.flagCacheService.getCacheStats();
  }
}
