'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FeatureFlagClient, getFeatureFlagClient } from './client';
import { EvaluationResult } from './types';

interface FeatureFlagContextValue {
  client: FeatureFlagClient;
  userId: string | null;
  context: Record<string, any>;
  setUserId: (userId: string | null) => void;
  setContext: (context: Record<string, any>) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

interface FeatureFlagProviderProps {
  children: ReactNode;
  apiUrl?: string;
  userId?: string;
  context?: Record<string, any>;
  enablePolling?: boolean;
  pollingInterval?: number;
}

export function FeatureFlagProvider({
  children,
  apiUrl,
  userId: initialUserId,
  context: initialContext = {},
  enablePolling = false,
  pollingInterval = 30000,
}: FeatureFlagProviderProps) {
  const [client] = useState(() => getFeatureFlagClient(apiUrl));
  const [userId, setUserId] = useState<string | null>(initialUserId || null);
  const [context, setContext] = useState<Record<string, any>>(initialContext);

  useEffect(() => {
    if (enablePolling && userId) {
      client.startPolling(userId, context, pollingInterval);
    }

    return () => {
      if (enablePolling) {
        client.stopPolling();
      }
    };
  }, [client, userId, context, enablePolling, pollingInterval]);

  return (
    <FeatureFlagContext.Provider
      value={{
        client,
        userId,
        context,
        setUserId,
        setContext,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(flagKey: string, defaultValue: boolean = false) {
  const { client, userId, context } = useFeatureFlags();
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsEnabled(defaultValue);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchFlag = async () => {
      try {
        setIsLoading(true);
        const result = await client.evaluate(flagKey, userId, context, defaultValue);
        
        if (mounted) {
          setIsEnabled(result.value === true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setIsEnabled(defaultValue);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFlag();

    return () => {
      mounted = false;
    };
  }, [client, flagKey, userId, context, defaultValue]);

  return { isEnabled, isLoading, error };
}

/**
 * Hook to get a feature flag value
 */
export function useFeatureFlagValue<T = any>(
  flagKey: string,
  defaultValue: T
): { value: T; isLoading: boolean; error: Error | null } {
  const { client, userId, context } = useFeatureFlags();
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setValue(defaultValue);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchFlag = async () => {
      try {
        setIsLoading(true);
        const result = await client.evaluate(flagKey, userId, context, defaultValue);
        
        if (mounted) {
          setValue(result.value);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setValue(defaultValue);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFlag();

    return () => {
      mounted = false;
    };
  }, [client, flagKey, userId, context, defaultValue]);

  return { value, isLoading, error };
}

/**
 * Hook to get A/B test variant
 */
export function useABTestVariant(
  flagKey: string
): { variant: string | undefined; isLoading: boolean; error: Error | null } {
  const { client, userId, context } = useFeatureFlags();
  const [variant, setVariant] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchVariant = async () => {
      try {
        setIsLoading(true);
        const result = await client.getVariant(flagKey, userId, context);
        
        if (mounted) {
          setVariant(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchVariant();

    return () => {
      mounted = false;
    };
  }, [client, flagKey, userId, context]);

  return { variant, isLoading, error };
}

/**
 * Hook to evaluate multiple flags at once
 */
export function useBulkFeatureFlags(flagKeys: string[]) {
  const { client, userId, context } = useFeatureFlags();
  const [flags, setFlags] = useState<Record<string, EvaluationResult>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || flagKeys.length === 0) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchFlags = async () => {
      try {
        setIsLoading(true);
        const results = await client.bulkEvaluate(flagKeys, userId, context);
        
        if (mounted) {
          setFlags(results);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFlags();

    return () => {
      mounted = false;
    };
  }, [client, flagKeys, userId, context]);

  return { flags, isLoading, error };
}
