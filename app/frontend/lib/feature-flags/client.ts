import { EvaluationResult, FlagContext } from './types';

export class FeatureFlagClient {
  private apiUrl: string;
  private flagCache: Map<string, EvaluationResult> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private eventSource: EventSource | null = null;

  constructor(apiUrl: string = '/api/feature-flags') {
    this.apiUrl = apiUrl;
  }

  /**
   * Evaluate a single feature flag
   */
  async evaluate(
    flagKey: string,
    userId: string,
    context?: Record<string, any>,
    defaultValue?: any
  ): Promise<EvaluationResult> {
    try {
      const response = await fetch(`${this.apiUrl}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKey,
          userId,
          context,
          defaultValue,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to evaluate flag: ${response.statusText}`);
      }

      const result: EvaluationResult = await response.json();
      
      // Cache the result
      this.flagCache.set(flagKey, result);
      
      return result;
    } catch (error) {
      console.error(`Error evaluating flag ${flagKey}:`, error);
      
      // Return cached value if available
      const cached = this.flagCache.get(flagKey);
      if (cached) {
        return cached;
      }
      
      // Return default
      return {
        value: defaultValue ?? false,
        reason: 'evaluation_error',
        flagKey,
      };
    }
  }

  /**
   * Evaluate multiple flags at once
   */
  async bulkEvaluate(
    flagKeys: string[],
    userId: string,
    context?: Record<string, any>
  ): Promise<Record<string, EvaluationResult>> {
    try {
      const response = await fetch(`${this.apiUrl}/bulk-evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKeys,
          userId,
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk evaluate flags: ${response.statusText}`);
      }

      const results: Record<string, EvaluationResult> = await response.json();
      
      // Cache the results
      Object.entries(results).forEach(([key, result]) => {
        this.flagCache.set(key, result);
      });
      
      return results;
    } catch (error) {
      console.error('Error bulk evaluating flags:', error);
      return {};
    }
  }

  /**
   * Check if a flag is enabled (convenience method)
   */
  async isEnabled(
    flagKey: string,
    userId: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const result = await this.evaluate(flagKey, userId, context, false);
    return result.value === true;
  }

  /**
   * Get flag value with type safety
   */
  async getValue<T = any>(
    flagKey: string,
    userId: string,
    defaultValue: T,
    context?: Record<string, any>
  ): Promise<T> {
    const result = await this.evaluate(flagKey, userId, context, defaultValue);
    return result.value as T;
  }

  /**
   * Get variant for A/B test
   */
  async getVariant(
    flagKey: string,
    userId: string,
    context?: Record<string, any>
  ): Promise<string | undefined> {
    const result = await this.evaluate(flagKey, userId, context);
    return result.variant;
  }

  /**
   * Start polling for flag updates
   */
  startPolling(userId: string, context?: Record<string, any>, intervalMs: number = 30000) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(async () => {
      const flagKeys = Array.from(this.flagCache.keys());
      if (flagKeys.length > 0) {
        await this.bulkEvaluate(flagKeys, userId, context);
      }
    }, intervalMs);
  }

  /**
   * Stop polling for updates
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Get analytics for a flag
   */
  async getAnalytics(
    flagKey: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await fetch(`${this.apiUrl}/${flagKey}/analytics?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting analytics for flag ${flagKey}:`, error);
      return null;
    }
  }

  /**
   * Clear local cache
   */
  clearCache() {
    this.flagCache.clear();
  }

  /**
   * Get cached value (no API call)
   */
  getCached(flagKey: string): EvaluationResult | undefined {
    return this.flagCache.get(flagKey);
  }
}

// Create a singleton instance
let clientInstance: FeatureFlagClient | null = null;

export function getFeatureFlagClient(apiUrl?: string): FeatureFlagClient {
  if (!clientInstance) {
    clientInstance = new FeatureFlagClient(apiUrl);
  }
  return clientInstance;
}
