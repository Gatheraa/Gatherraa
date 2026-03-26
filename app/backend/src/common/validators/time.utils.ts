/**
 * Time-based utilities with tolerance ranges and alternative time sources
 * Addresses: Block number alternatives, tolerance ranges, oracle-based time sources
 */

import { isNumber, isString } from 'class-validator';

/**
 * Time tolerance constants (in milliseconds)
 */
export const TIME_TOLERANCE = {
  // Maximum acceptable drift between system time and oracle time
  MAX_DRIFT: 300000, // 5 minutes
  
  // Minimum tolerance for time comparisons
  MIN_TOLERANCE: 1000, // 1 second
  
  // Default tolerance for scheduled tasks
  DEFAULT_SCHEDULE_TOLERANCE: 60000, // 1 minute
  
  // Tolerance for token expiry checks (5 minutes)
  TOKEN_EXPIRY_TOLERANCE: 300000,
  
  // Tolerance for cache invalidation (1 minute)
  CACHE_INVALIDATION_TOLERANCE: 60000,
  
  // Tolerance for webhook retry (5 minutes)
  WEBHOOK_RETRY_TOLERANCE: 300000,
  
  // Maximum age for cached timestamps
  MAX_TIMESTAMP_AGE: 3600000, // 1 hour
} as const;

/**
 * Configuration for time-based operations
 */
export interface TimeConfig {
  useOracleTime: boolean;
  toleranceMs: number;
  maxDriftMs: number;
}

/**
 * Default time configuration
 */
export const DEFAULT_TIME_CONFIG: TimeConfig = {
  useOracleTime: false,
  toleranceMs: TIME_TOLERANCE.DEFAULT_SCHEDULE_TOLERANCE,
  maxDriftMs: TIME_TOLERANCE.MAX_DRIFT,
};

/**
 * Time source interface for oracle-based time
 */
export interface TimeSource {
  /**
   * Get current timestamp from the time source
   */
  getCurrentTime(): number;
  
  /**
   * Check if time source is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get time source name/identifier
   */
  getSourceName(): string;
}

/**
 * System time source (default)
 */
export class SystemTimeSource implements TimeSource {
  getCurrentTime(): number {
    return Date.now();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getSourceName(): string {
    return 'system';
  }
}

/**
 * Mock oracle time source for testing
 */
export class OracleTimeSource implements TimeSource {
  private mockTime: number;
  private available: boolean = true;

  constructor(initialTime?: number) {
    this.mockTime = initialTime || Date.now();
  }

  getCurrentTime(): number {
    return this.mockTime;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  getSourceName(): string {
    return 'oracle';
  }

  setMockTime(time: number): void {
    this.mockTime = time;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }
}

/**
 * Time service with tolerance and oracle support
 */
export class TimeService {
  private timeSource: TimeSource;
  private tolerance: number;
  private maxDrift: number;
  private lastOracleSync: number = 0;

  constructor(
    timeSource: TimeSource = new SystemTimeSource(),
    tolerance: number = TIME_TOLERANCE.DEFAULT_SCHEDULE_TOLERANCE,
    maxDrift: number = TIME_TOLERANCE.MAX_DRIFT,
  ) {
    this.timeSource = timeSource;
    this.tolerance = tolerance;
    this.maxDrift = maxDrift;
  }

  /**
   * Get current time with tolerance check
   */
  async getCurrentTime(): Promise<number> {
    return this.timeSource.getCurrentTime();
  }

  /**
   * Check if a timestamp is within acceptable range
   */
  isWithinTolerance(timestamp: number, referenceTime?: number): boolean {
    const reference = referenceTime || Date.now();
    const diff = Math.abs(timestamp - reference);
    return diff <= this.tolerance;
  }

  /**
   * Check if timestamp is expired (with tolerance)
   */
  isExpired(expiryTime: number, tolerance: number = TIME_TOLERANCE.TOKEN_EXPIRY_TOLERANCE): boolean {
    const currentTime = Date.now();
    return currentTime + tolerance > expiryTime;
  }

  /**
   * Get time until expiry with tolerance applied
   */
  getTimeUntilExpiry(expiryTime: number, tolerance: number = TIME_TOLERANCE.TOKEN_EXPIRY_TOLERANCE): number {
    const currentTime = Date.now();
    return Math.max(0, expiryTime - tolerance - currentTime);
  }

  /**
   * Check if time drift is within acceptable limits
   */
  async validateTimeDrift(): Promise<{ isValid: boolean; drift: number }> {
    const systemTime = Date.now();
    const oracleTime = await this.timeSource.getCurrentTime();
    const drift = Math.abs(systemTime - oracleTime);
    
    return {
      isValid: drift <= this.maxDrift,
      drift,
    };
  }

  /**
   * Calculate next sync time with jitter
   */
  calculateNextSyncTime(
    baseInterval: number,
    jitterPercent: number = 0.1,
  ): number {
    const jitter = baseInterval * jitterPercent;
    const randomJitter = Math.random() * jitter * 2 - jitter;
    return Date.now() + baseInterval + randomJitter;
  }

  /**
   * Get date with tolerance range
   */
  getDateWithTolerance(date: Date, toleranceMs: number = TIME_TOLERANCE.DEFAULT_SCHEDULE_TOLERANCE): {
    earliest: Date;
    latest: Date;
    isValid: boolean;
  } {
    const timestamp = date.getTime();
    const now = Date.now();
    const diff = Math.abs(timestamp - now);
    
    return {
      earliest: new Date(timestamp - toleranceMs),
      latest: new Date(timestamp + toleranceMs),
      isValid: diff <= toleranceMs * 2, // Allow for ±tolerance
    };
  }

  /**
   * Compare timestamps with tolerance
   */
  compareTimestamps(
    timestamp1: number,
    timestamp2: number,
    tolerance: number = this.tolerance,
  ): 'before' | 'after' | 'within_tolerance' {
    const diff = timestamp1 - timestamp2;
    
    if (Math.abs(diff) <= tolerance) {
      return 'within_tolerance';
    }
    return diff > 0 ? 'after' : 'before';
  }

  /**
   * Get a timestamp that's guaranteed to be in the past (with tolerance)
   */
  getPastTimestamp(tolerance: number = TIME_TOLERANCE.CACHE_INVALIDATION_TOLERANCE): number {
    return Date.now() - tolerance;
  }

  /**
   * Get a timestamp that's guaranteed to be in the future
   */
  getFutureTimestamp(tolerance: number = TIME_TOLERANCE.WEBHOOK_RETRY_TOLERANCE): number {
    return Date.now() + tolerance;
  }

  /**
   * Format relative time description
   */
  getRelativeTimeDescription(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (absDiff < 60000) return 'in less than a minute';
      if (absDiff < 3600000) return `in ${Math.floor(absDiff / 60000)} minutes`;
      if (absDiff < 86400000) return `in ${Math.floor(absDiff / 3600000)} hours`;
      return `in ${Math.floor(absDiff / 86400000)} days`;
    }
    
    if (diff < 60000) return 'less than a minute ago';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }
}

/**
 * Singleton time service instance
 */
export const timeService = new TimeService();

/**
 * Helper to create time service with custom configuration
 */
export function createTimeService(config: Partial<TimeConfig>): TimeService {
  return new TimeService(
    new SystemTimeSource(),
    config.toleranceMs || DEFAULT_TIME_CONFIG.toleranceMs,
    config.maxDriftMs || DEFAULT_TIME_CONFIG.maxDriftMs,
  );
}

/**
 * Validation helper for date inputs
 */
export const DateValidation = {
  /**
   * Check if date string is valid
   */
  isValidDateString: (value: string): boolean => {
    if (!isString(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  /**
   * Check if date is not in the future (with tolerance)
   */
  isNotFutureDate: (date: Date, tolerance: number = TIME_TOLERANCE.MIN_TOLERANCE): boolean => {
    return date.getTime() <= Date.now() + tolerance;
  },

  /**
   * Check if date is not in the past (with tolerance)
   */
  isNotPastDate: (date: Date, tolerance: number = TIME_TOLERANCE.MIN_TOLERANCE): boolean => {
    return date.getTime() >= Date.now() - tolerance;
  },

  /**
   * Check if date range is valid (start before end)
   */
  isValidDateRange: (startDate: Date, endDate: Date): boolean => {
    return startDate.getTime() < endDate.getTime();
  },
} as const;
