import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, SegmentRule, TargetingRule, FlagStatus } from '../entities/feature-flag.entity';
import { FlagEvaluation } from '../entities/flag-evaluation.entity';
import { createHash } from 'crypto';

export interface EvaluationContext {
  userId: string;
  userAttributes?: Record<string, any>;
  environment?: string;
  [key: string]: any;
}

export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: string;
  flagKey: string;
}

@Injectable()
export class FlagEvaluationService {
  private readonly logger = new Logger(FlagEvaluationService.name);

  constructor(
    @InjectRepository(FlagEvaluation)
    private flagEvaluationRepository: Repository<FlagEvaluation>,
  ) {}

  /**
   * Evaluate a single feature flag for a user
   */
  async evaluateFlag(
    flag: FeatureFlag,
    context: EvaluationContext,
    trackEvaluation: boolean = true,
  ): Promise<EvaluationResult> {
    const { userId, userAttributes = {} } = context;

    // Check if flag is active
    if (flag.status !== FlagStatus.ACTIVE) {
      return {
        value: flag.defaultValue,
        reason: 'flag_inactive',
        flagKey: flag.key,
      };
    }

    // Check blacklist
    if (flag.blacklist && flag.blacklist.includes(userId)) {
      const result = {
        value: false,
        reason: 'blacklist',
        flagKey: flag.key,
      };
      if (trackEvaluation) {
        await this.trackEvaluation(flag.key, userId, result, context);
      }
      return result;
    }

    // Check whitelist
    if (flag.whitelist && flag.whitelist.includes(userId)) {
      const result = {
        value: true,
        reason: 'whitelist',
        flagKey: flag.key,
      };
      if (trackEvaluation) {
        await this.trackEvaluation(flag.key, userId, result, context);
      }
      return result;
    }

    // Evaluate targeting rules
    if (flag.targetingRules && flag.targetingRules.length > 0) {
      for (const rule of flag.targetingRules) {
        if (this.evaluateTargetingRule(rule, { userId, ...userAttributes })) {
          // If rule has its own rollout, check that
          if (rule.rollout) {
            const inRollout = this.checkRollout(userId, rule.rollout, flag.key);
            if (inRollout) {
              const result = {
                value: rule.value,
                reason: `targeting_rule:${rule.name}`,
                flagKey: flag.key,
              };
              if (trackEvaluation) {
                await this.trackEvaluation(flag.key, userId, result, context);
              }
              return result;
            }
          } else {
            const result = {
              value: rule.value,
              reason: `targeting_rule:${rule.name}`,
              flagKey: flag.key,
            };
            if (trackEvaluation) {
              await this.trackEvaluation(flag.key, userId, result, context);
            }
            return result;
          }
        }
      }
    }

    // A/B Testing
    if (flag.abTestConfig) {
      const abTestResult = this.evaluateABTest(userId, flag.abTestConfig, flag.key);
      const result = {
        value: abTestResult.value,
        variant: abTestResult.variant,
        reason: 'ab_test',
        flagKey: flag.key,
      };
      if (trackEvaluation) {
        await this.trackEvaluation(flag.key, userId, result, context);
      }
      return result;
    }

    // Percentage rollout
    if (flag.rolloutConfig) {
      const inRollout = this.checkRollout(userId, flag.rolloutConfig, flag.key);
      const result = {
        value: inRollout ? true : flag.defaultValue,
        reason: inRollout ? 'rollout' : 'default',
        flagKey: flag.key,
      };
      if (trackEvaluation) {
        await this.trackEvaluation(flag.key, userId, result, context);
      }
      return result;
    }

    // Default value
    const result = {
      value: flag.defaultValue,
      reason: 'default',
      flagKey: flag.key,
    };
    if (trackEvaluation) {
      await this.trackEvaluation(flag.key, userId, result, context);
    }
    return result;
  }

  /**
   * Evaluate targeting rule with segment conditions
   */
  private evaluateTargetingRule(rule: TargetingRule, userContext: Record<string, any>): boolean {
    if (!rule.segments || rule.segments.length === 0) {
      return true;
    }

    // Segments are OR'ed together, conditions within a segment are AND'ed
    return rule.segments.some((segmentGroup) =>
      segmentGroup.every((segment) => this.evaluateSegment(segment, userContext))
    );
  }

  /**
   * Evaluate a single segment rule
   */
  private evaluateSegment(segment: SegmentRule, userContext: Record<string, any>): boolean {
    const actualValue = userContext[segment.field];
    const expectedValue = segment.value;

    switch (segment.operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'notEquals':
        return actualValue !== expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'notIn':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      case 'contains':
        if (typeof actualValue === 'string') {
          return actualValue.includes(expectedValue);
        }
        if (Array.isArray(actualValue)) {
          return actualValue.includes(expectedValue);
        }
        return false;
      case 'greaterThan':
        return actualValue > expectedValue;
      case 'lessThan':
        return actualValue < expectedValue;
      default:
        return false;
    }
  }

  /**
   * Check if user is in percentage rollout using consistent hashing
   */
  private checkRollout(userId: string, rolloutConfig: any, flagKey: string): boolean {
    const { percentage, seed } = rolloutConfig;
    
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    // Use consistent hashing for deterministic rollout
    const hashInput = seed ? `${flagKey}:${userId}:${seed}` : `${flagKey}:${userId}`;
    const hash = createHash('md5').update(hashInput).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const userPercentile = (hashValue % 10000) / 100;

    return userPercentile < percentage;
  }

  /**
   * Evaluate A/B test variant for user
   */
  private evaluateABTest(userId: string, abTestConfig: any, flagKey: string): { value: any; variant: string } {
    const { variants, exposurePercentage = 100 } = abTestConfig;

    // Check if user is in the exposed group
    if (exposurePercentage < 100) {
      const inExposure = this.checkRollout(userId, { percentage: exposurePercentage }, `${flagKey}:exposure`);
      if (!inExposure) {
        return { value: false, variant: 'control' };
      }
    }

    // Assign variant based on consistent hashing
    const hash = createHash('md5').update(`${flagKey}:${userId}`).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const userPercentile = hashValue % 100;

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (userPercentile < cumulativeWeight) {
        return { value: variant.value, variant: variant.name };
      }
    }

    // Fallback to last variant
    const lastVariant = variants[variants.length - 1];
    return { value: lastVariant.value, variant: lastVariant.name };
  }

  /**
   * Track flag evaluation for analytics
   */
  private async trackEvaluation(
    flagKey: string,
    userId: string,
    result: EvaluationResult,
    context: EvaluationContext,
  ): Promise<void> {
    try {
      const evaluation = this.flagEvaluationRepository.create({
        flagKey,
        userId,
        value: result.value,
        variant: result.variant,
        context,
        reason: result.reason,
      });

      await this.flagEvaluationRepository.save(evaluation);
    } catch (error) {
      this.logger.error(`Error tracking evaluation: ${error.message}`, error.stack);
    }
  }

  /**
   * Get analytics for a flag
   */
  async getFlagAnalytics(flagKey: string, startDate?: Date, endDate?: Date) {
    const query = this.flagEvaluationRepository
      .createQueryBuilder('evaluation')
      .where('evaluation.flagKey = :flagKey', { flagKey });

    if (startDate) {
      query.andWhere('evaluation.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('evaluation.createdAt <= :endDate', { endDate });
    }

    const evaluations = await query.getMany();

    // Calculate statistics
    const totalEvaluations = evaluations.length;
    const uniqueUsers = new Set(evaluations.map((e) => e.userId)).size;
    
    const valueDistribution = evaluations.reduce((acc, evaluation) => {
      const key = JSON.stringify(evaluation.value);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const variantDistribution = evaluations.reduce((acc, evaluation) => {
      if (evaluation.variant) {
        acc[evaluation.variant] = (acc[evaluation.variant] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const reasonDistribution = evaluations.reduce((acc, evaluation) => {
      acc[evaluation.reason] = (acc[evaluation.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      flagKey,
      totalEvaluations,
      uniqueUsers,
      valueDistribution,
      variantDistribution,
      reasonDistribution,
      startDate,
      endDate,
    };
  }
}
