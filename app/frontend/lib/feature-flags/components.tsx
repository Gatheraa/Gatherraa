'use client';

import { ReactNode } from 'react';
import { useFeatureFlag } from './hooks';

interface FeatureGateProps {
  flagKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  defaultValue?: boolean;
  inverse?: boolean;
}

/**
 * Component to conditionally render children based on feature flag
 */
export function FeatureGate({
  flagKey,
  children,
  fallback = null,
  defaultValue = false,
  inverse = false,
}: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureFlag(flagKey, defaultValue);

  if (isLoading) {
    return <>{fallback}</>;
  }

  const shouldRender = inverse ? !isEnabled : isEnabled;

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

interface ABTestProps {
  flagKey: string;
  variants: Record<string, ReactNode>;
  defaultVariant?: ReactNode;
}

/**
 * Component to render different variants for A/B testing
 */
export function ABTest({ flagKey, variants, defaultVariant = null }: ABTestProps) {
  const { isEnabled } = useFeatureFlag(flagKey);

  // For now, just use isEnabled as a simple variant selector
  // In a full implementation, you'd use the variant from the evaluation
  if (isEnabled && variants.treatment) {
    return <>{variants.treatment}</>;
  }

  return <>{variants.control || defaultVariant}</>;
}
