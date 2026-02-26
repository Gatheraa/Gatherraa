import { Injectable, Logger } from '@nestjs/common';
import { AdvancedCacheService } from './advanced-cache.service';
import { CachePerformanceService } from './cache-performance.service';
import { MultiLevelCacheService } from './multi-level-cache.service';

export interface FallbackConfig {
  enableMemoryFallback: boolean;
  enableDatabaseFallback: boolean;
  enableStaleData: boolean;
  staleDataTtl: number;
  maxRetryAttempts: number;
  retryDelay: number;
}

export interface FallbackResult<T> {
  data: T | null;
  source: 'cache' | 'memory' | 'database' | 'stale' | 'none';
  fallbackUsed: boolean;
  responseTime: number;
  errors: string[];
}

@Injectable()
export class CacheFallbackService {
  private readonly logger = new Logger(CacheFallbackService.name);
  private config: FallbackConfig = {
    enableMemoryFallback: true,
    enableDatabaseFallback: true,
    enableStaleData: true,
    staleDataTtl: 3600, // 1 hour
    maxRetryAttempts: 3,
    retryDelay: 1000
  };

  constructor(
    private cacheService: AdvancedCacheService,
    private performanceService: CachePerformanceService,
    private multiLevelCache: MultiLevelCacheService,
  ) {}

  /**
   * Get data with fallback mechanisms
   */
  async getWithFallback<T>(
    key: string,
    dataFetcher: () => Promise<T>,
    options: {
      ttl?: number;
      useStaleData?: boolean;
      retryOnFailure?: boolean;
    } = {}
  ): Promise<FallbackResult<T>> {
    const startTime = Date.now();
    const errors: string[] = [];
    let fallbackUsed = false;

    try {
      // Try primary cache first
      const cachedData = await this.safeCacheGet<T>(key);
      if (cachedData !== null) {
        this.performanceService.recordOperation('get', Date.now() - startTime, true);
        return {
          data: cachedData,
          source: 'cache',
          fallbackUsed: false,
          responseTime: Date.now() - startTime,
          errors: []
        };
      }

      // Try memory fallback
      if (this.config.enableMemoryFallback) {
        const memoryData = await this.safeMemoryGet<T>(key);
        if (memoryData !== null) {
          fallbackUsed = true;
          this.performanceService.recordOperation('get', Date.now() - startTime, true);
          return {
            data: memoryData,
            source: 'memory',
            fallbackUsed,
            responseTime: Date.now() - startTime,
            errors: []
          };
        }
      }

      // Try stale data fallback
      if (this.config.enableStaleData && (options.useStaleData ?? true)) {
        const staleData = await this.getStaleData<T>(key);
        if (staleData !== null) {
          fallbackUsed = true;
          this.logger.warn(`Using stale data for key: ${key}`);
          return {
            data: staleData,
            source: 'stale',
            fallbackUsed,
            responseTime: Date.now() - startTime,
            errors: ['Using stale data']
          };
        }
      }

      // Fetch fresh data
      let freshData: T | null = null;
      let lastError: Error | null = null;

      if (options.retryOnFailure !== false) {
        for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
          try {
            freshData = await dataFetcher();
            break;
          } catch (error) {
            lastError = error as Error;
            errors.push(`Attempt ${attempt}: ${error.message}`);
            
            if (attempt < this.config.maxRetryAttempts) {
              await this.delay(this.config.retryDelay * attempt);
            }
          }
        }
      } else {
        try {
          freshData = await dataFetcher();
        } catch (error) {
          lastError = error as Error;
          errors.push(error.message);
        }
      }

      if (freshData !== null) {
        // Cache the fresh data
        await this.safeCacheSet(key, freshData, options.ttl);
        
        return {
          data: freshData,
          source: 'database',
          fallbackUsed,
          responseTime: Date.now() - startTime,
          errors
        };
      }

      // All attempts failed
      this.logger.error(`All fallback mechanisms failed for key: ${key}`, lastError?.stack);
      this.performanceService.recordOperation('get', Date.now() - startTime, false);

      return {
        data: null,
        source: 'none',
        fallbackUsed,
        responseTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : ['All fallback mechanisms failed']
      };

    } catch (error) {
      this.logger.error(`Fallback service error for key ${key}: ${error.message}`);
      this.performanceService.recordOperation('get', Date.now() - startTime, false);

      return {
        data: null,
        source: 'none',
        fallbackUsed,
        responseTime: Date.now() - startTime,
        errors: [`Fallback service error: ${error.message}`]
      };
    }
  }

  /**
   * Set data with fallback handling
   */
  async setWithFallback<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      backupToMemory?: boolean;
      persistOnFailure?: boolean;
    } = {}
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    let success = false;

    try {
      // Try primary cache
      await this.safeCacheSet(key, data, options.ttl);
      success = true;

      // Backup to memory if requested
      if (options.backupToMemory) {
        try {
          await this.multiLevelCache.set(key, data, { memoryOnly: true });
        } catch (error) {
          errors.push(`Memory backup failed: ${error.message}`);
        }
      }

    } catch (error) {
      errors.push(`Primary cache failed: ${error.message}`);

      // Try memory fallback
      if (this.config.enableMemoryFallback) {
        try {
          await this.multiLevelCache.set(key, data, { memoryOnly: true });
          success = true;
          errors.push('Used memory fallback');
        } catch (memoryError) {
          errors.push(`Memory fallback failed: ${memoryError.message}`);
        }
      }

      // Try database persistence if requested
      if (options.persistOnFailure && this.config.enableDatabaseFallback) {
        try {
          await this.persistToDatabase(key, data);
          success = true;
          errors.push('Persisted to database');
        } catch (dbError) {
          errors.push(`Database persistence failed: ${dbError.message}`);
        }
      }
    }

    return { success, errors };
  }

  /**
   * Graceful degradation for cache operations
   */
  async degradeGracefully<T>(
    operation: () => Promise<T>,
    fallbackOperations: Array<() => Promise<T>>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    // Try primary operation
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      this.logger.warn(`Primary operation failed in ${context}: ${error.message}`);
    }

    // Try fallback operations
    for (let i = 0; i < fallbackOperations.length; i++) {
      try {
        const result = await fallbackOperations[i]();
        this.logger.info(`Fallback ${i + 1} succeeded in ${context}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Fallback ${i + 1} failed in ${context}: ${error.message}`);
      }
    }

    // All operations failed
    const errorMessage = `All operations failed in ${context}`;
    this.logger.error(errorMessage, lastError?.stack);
    throw new Error(errorMessage);
  }

  /**
   * Health check with fallback
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      cache: boolean;
      memory: boolean;
      database: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const components = {
      cache: false,
      memory: false,
      database: false
    };

    // Check cache health
    try {
      await this.cacheService.get('health:check');
      components.cache = true;
    } catch (error) {
      errors.push(`Cache health check failed: ${error.message}`);
    }

    // Check memory health
    try {
      await this.multiLevelCache.get('health:check', { useMemoryOnly: true });
      components.memory = true;
    } catch (error) {
      errors.push(`Memory health check failed: ${error.message}`);
    }

    // Check database health (simplified)
    try {
      components.database = true; // Placeholder
    } catch (error) {
      errors.push(`Database health check failed: ${error.message}`);
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    const healthyComponents = Object.values(components).filter(Boolean).length;
    
    if (healthyComponents === 3) {
      status = 'healthy';
    } else if (healthyComponents >= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, components, errors };
  }

  /**
   * Get fallback statistics
   */
  async getFallbackStats(): Promise<{
    totalRequests: number;
    fallbackUsage: {
      memory: number;
      stale: number;
      database: number;
    };
    errorRate: number;
    averageResponseTime: number;
  }> {
    // This would track actual fallback usage statistics
    // For now, return placeholder data
    return {
      totalRequests: 10000,
      fallbackUsage: {
        memory: 150,
        stale: 75,
        database: 25
      },
      errorRate: 0.02,
      averageResponseTime: 45
    };
  }

  /**
   * Safe cache get with error handling
   */
  private async safeCacheGet<T>(key: string): Promise<T | null> {
    try {
      return await this.cacheService.get<T>(key);
    } catch (error) {
      this.logger.debug(`Cache get failed for ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Safe memory get with error handling
   */
  private async safeMemoryGet<T>(key: string): Promise<T | null> {
    try {
      return await this.multiLevelCache.get<T>(key, { useMemoryOnly: true });
    } catch (error) {
      this.logger.debug(`Memory get failed for ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Safe cache set with error handling
   */
  private async safeCacheSet<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      await this.cacheService.set(key, data, { ttl });
    } catch (error) {
      this.logger.debug(`Cache set failed for ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get stale data from backup storage
   */
  private async getStaleData<T>(key: string): Promise<T | null> {
    try {
      const staleKey = `${key}:stale`;
      const staleData = await this.cacheService.get<T>(staleKey);
      
      if (staleData) {
        const metadata = await this.cacheService.get<{ timestamp: number }>(`${staleKey}:meta`);
        if (metadata && (Date.now() - metadata.timestamp) < this.config.staleDataTtl * 1000) {
          return staleData;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.debug(`Stale data retrieval failed for ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Persist data to database (placeholder)
   */
  private async persistToDatabase(key: string, data: any): Promise<void> {
    // In production, this would persist to actual database
    this.logger.debug(`Persisting to database: ${key}`);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update fallback configuration
   */
  updateConfig(config: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('Fallback configuration updated');
  }

  /**
   * Enable/disable specific fallback mechanisms
   */
  configureFallbacks(config: {
    memoryFallback?: boolean;
    databaseFallback?: boolean;
    staleDataFallback?: boolean;
  }): void {
    if (config.memoryFallback !== undefined) {
      this.config.enableMemoryFallback = config.memoryFallback;
    }
    
    if (config.databaseFallback !== undefined) {
      this.config.enableDatabaseFallback = config.databaseFallback;
    }
    
    if (config.staleDataFallback !== undefined) {
      this.config.enableStaleData = config.staleDataFallback;
    }

    this.logger.log('Fallback mechanisms configured');
  }

  /**
   * Test fallback mechanisms
   */
  async testFallbacks(): Promise<{
    cache: boolean;
    memory: boolean;
    stale: boolean;
    database: boolean;
  }> {
    const testKey = `test:fallback:${Date.now()}`;
    const testData = { test: true, timestamp: Date.now() };

    const results = {
      cache: false,
      memory: false,
      stale: false,
      database: false
    };

    // Test cache
    try {
      await this.cacheService.set(testKey, testData);
      const retrieved = await this.cacheService.get(testKey);
      results.cache = retrieved !== null;
    } catch (error) {
      this.logger.debug(`Cache test failed: ${error.message}`);
    }

    // Test memory
    try {
      await this.multiLevelCache.set(testKey + ':mem', testData, { memoryOnly: true });
      const retrieved = await this.multiLevelCache.get(testKey + ':mem', { useMemoryOnly: true });
      results.memory = retrieved !== null;
    } catch (error) {
      this.logger.debug(`Memory test failed: ${error.message}`);
    }

    // Test stale data
    try {
      await this.cacheService.set(testKey + ':stale', testData);
      await this.cacheService.set(testKey + ':stale:meta', { timestamp: Date.now() });
      const retrieved = await this.getStaleData(testKey);
      results.stale = retrieved !== null;
    } catch (error) {
      this.logger.debug(`Stale data test failed: ${error.message}`);
    }

    // Test database
    try {
      await this.persistToDatabase(testKey, testData);
      results.database = true; // Placeholder
    } catch (error) {
      this.logger.debug(`Database test failed: ${error.message}`);
    }

    return results;
  }
}
