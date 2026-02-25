export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: 'boolean' | 'rollout' | 'ab_test' | 'kill_switch';
  environment: 'development' | 'staging' | 'production';
  status: 'active' | 'inactive' | 'archived';
  defaultValue: any;
  targetingRules?: TargetingRule[];
  rolloutConfig?: RolloutConfig;
  abTestConfig?: ABTestConfig;
  whitelist?: string[];
  blacklist?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetingRule {
  name: string;
  description?: string;
  segments: SegmentRule[][];
  value: any;
  rollout?: RolloutConfig;
}

export interface SegmentRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface RolloutConfig {
  percentage: number;
  seed?: string;
}

export interface ABTestConfig {
  variants: {
    name: string;
    weight: number;
    value: any;
  }[];
  exposurePercentage?: number;
}

export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: string;
  flagKey: string;
}

export interface FlagContext {
  userId: string;
  userAttributes?: Record<string, any>;
  [key: string]: any;
}
