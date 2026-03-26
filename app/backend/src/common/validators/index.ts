/**
 * Common validation utilities
 * Exports comprehensive validation decorators, sanitization helpers, and time-based utilities
 */

// Validation decorators and utilities
export {
  // Constants
  MAX_LENGTHS,
  MIN_LENGTHS,
  VALID_RANGES,
  URL_PROTOCOLS,
  PATTERNS,
  
  // Custom validators
  IsValidUUID,
  IsSecureUrl,
  IsNonEmptyString,
  IsSanitizedInput,
  IsValidDateRange,
  IsPositiveNumber,
  IsNonNegativeNumber,
  
  // Validation utilities
  SanitizationUtils,
  RangeValidation,
} from './validation.utils';

// Time-based utilities
export {
  // Constants
  TIME_TOLERANCE,
  DEFAULT_TIME_CONFIG,
  
  // Classes
  SystemTimeSource,
  OracleTimeSource,
  TimeService,
  
  // Helpers
  timeService,
  createTimeService,
  DateValidation,
} from './time.utils';

// Re-export types
export type { TimeSource, TimeConfig } from './time.utils';
