import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'featureFlag';

/**
 * Decorator to protect routes with feature flags
 * @param flagKey - The feature flag key to check
 * @param requireEnabled - Whether the flag should be enabled (default: true)
 */
export const FeatureFlag = (flagKey: string, requireEnabled: boolean = true) =>
  SetMetadata(FEATURE_FLAG_KEY, { flagKey, requireEnabled });
