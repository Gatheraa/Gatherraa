export { FeatureFlagClient, getFeatureFlagClient } from './client';
export {
  FeatureFlagProvider,
  useFeatureFlags,
  useFeatureFlag,
  useFeatureFlagValue,
  useABTestVariant,
  useBulkFeatureFlags,
} from './hooks';
export { FeatureGate, ABTest } from './components';
export type {
  FeatureFlag,
  TargetingRule,
  SegmentRule,
  RolloutConfig,
  ABTestConfig,
  EvaluationResult,
  FlagContext,
} from './types';
