/**
 * Validation utilities for comprehensive input validation
 * Addresses: Type validation, range validation, address validation, parameter sanitization, input length limits
 */

import {
  ValidationOptions,
  registerDecorator,
  ValidationContext,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isURL, isUUID, isEmail, isString, isNumber } from 'class-validator';

/**
 * Supported URL protocols
 */
export const URL_PROTOCOLS = ['https', 'http'];

/**
 * Maximum lengths for string inputs
 */
export const MAX_LENGTHS = {
  NAME: 255,
  DESCRIPTION: 2000,
  SLUG: 100,
  VERSION: 50,
  EMAIL: 255,
  URL: 2048,
  API_KEY: 512,
  GENERAL_STRING: 1000,
  PAYLOAD: 50000,
} as const;

/**
 * Minimum lengths for string inputs
 */
export const MIN_LENGTHS = {
  NAME: 1,
  SLUG: 3,
  VERSION: 1,
  PASSWORD: 8,
} as const;

/**
 * Valid ranges for numeric inputs
 */
export const VALID_RANGES = {
  SYNC_INTERVAL: { min: 1, max: 1440 }, // 1 minute to 24 hours in minutes
  RATE_LIMIT: { min: 1, max: 10000 },
  MAX_RETRIES: { min: 0, max: 10 },
  RATING: { min: 1, max: 5 },
  PRIORITY: { min: 0, max: 100 },
  PAGE: { min: 1, max: 1000 },
  LIMIT: { min: 1, max: 100 },
  DAYS: { min: 1, max: 365 },
  PRICE: { min: 0, max: 999999.99 },
} as const;

/**
 * Regular expressions for input validation
 */
export const PATTERNS = {
  // Slug: lowercase letters, numbers, and hyphens only
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  // Version: semver format
  VERSION: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/,
  // UUID version
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

/**
 * Custom validator for UUID format
 */
@ValidatorConstraint({ async: false })
export class IsValidUUID implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!value) return true;
    if (typeof value !== 'string') return false;
    return isUUID(value);
  }

  defaultMessage(): string {
    return 'Value must be a valid UUID';
  }
}

/**
 * Custom validator for secure URL (HTTPS preferred)
 */
@ValidatorConstraint({ async: false })
export class IsSecureUrl implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!value) return true;
    if (typeof value !== 'string') return false;
    
    try {
      const url = new URL(value);
      return URL_PROTOCOLS.includes(url.protocol.replace(':', ''));
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Value must be a valid HTTP/HTTPS URL';
  }
}

/**
 * Custom validator for non-zero string (for addresses/IDs)
 */
@ValidatorConstraint({ async: false })
export class IsNonEmptyString implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!value) return false;
    if (typeof value !== 'string') return false;
    return value.trim().length > 0;
  }

  defaultMessage(): string {
    return 'Value cannot be empty or whitespace';
  }
}

/**
 * Custom validator for sanitized input (prevent injection attacks)
 */
@ValidatorConstraint({ async: false })
export class IsSanitizedInput implements ValidatorConstraintInterface {
  private readonly dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:\s*text\/html/i,
  ];

  validate(value: any): boolean {
    if (!value) return true;
    if (typeof value !== 'string') return false;

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return 'Input contains potentially dangerous content';
  }
}

/**
 * Custom validator for valid date range
 */
@ValidatorConstraint({ async: false })
export class IsValidDateRange implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!value) return true;
    
    // If it's a date string, check if it's valid
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    
    // If it's a number, check if it's a valid timestamp
    if (typeof value === 'number') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    
    return value instanceof Date;
  }

  defaultMessage(): string {
    return 'Invalid date format';
  }
}

/**
 * Custom validator for positive number
 */
@ValidatorConstraint({ async: false })
export class IsPositiveNumber implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'number') return false;
    return value > 0;
  }

  defaultMessage(): string {
    return 'Value must be a positive number';
  }
}

/**
 * Custom validator for non-negative number
 */
@ValidatorConstraint({ async: false })
export class IsNonNegativeNumber implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'number') return false;
    return value >= 0;
  }

  defaultMessage(): string {
    return 'Value must be a non-negative number';
  }
}

/**
 * Custom decorator for validated UUID
 */
export function IsValidUUID(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUUID,
    });
  };
}

/**
 * Custom decorator for secure URL
 */
export function IsSecureUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSecureUrl,
    });
  };
}

/**
 * Custom decorator for non-empty string
 */
export function IsNonEmptyString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNonEmptyString,
    });
  };
}

/**
 * Custom decorator for sanitized input
 */
export function IsSanitizedInput(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSanitizedInput,
    });
  };
}

/**
 * Custom decorator for valid date range
 */
export function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDateRange,
    });
  };
}

/**
 * Custom decorator for positive number
 */
export function IsPositiveNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveNumber,
    });
  };
}

/**
 * Custom decorator for non-negative number
 */
export function IsNonNegativeNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNonNegativeNumber,
    });
  };
}

/**
 * Input sanitization utility functions
 */
export const SanitizationUtils = {
  /**
   * Trim and normalize whitespace
   */
  trim: (value: string): string => {
    if (!isString(value)) return value;
    return value.trim().replace(/\s+/g, ' ');
  },

  /**
   * Remove dangerous characters
   */
  removeDangerousChars: (value: string): string => {
    if (!isString(value)) return value;
    // Remove null bytes and control characters
    return value.replace(/[\x00-\x1F\x7F]/g, '');
  },

  /**
   * Normalize URL by removing trailing slashes
   */
  normalizeUrl: (value: string): string => {
    if (!isString(value)) return value;
    return value.replace(/\/+$/, '');
  },

  /**
   * Escape HTML entities
   */
  escapeHtml: (value: string): string => {
    if (!isString(value)) return value;
    const map: Record<string, string> = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return value.replace(/[&<>"'/]/g, (char) => map[char]);
  },

  /**
   * Validate and sanitize UUID
   */
  sanitizeUuid: (value: string): string => {
    if (!isString(value)) return value;
    return value.trim().toLowerCase();
  },

  /**
   * Validate and sanitize version string
   */
  sanitizeVersion: (value: string): string => {
    if (!isString(value)) return value;
    return value.trim();
  },
} as const;

/**
 * Validation helper for checking ranges
 */
export const RangeValidation = {
  /**
   * Check if number is within valid sync interval range (1-1440 minutes)
   */
  isValidSyncInterval: (value: number): boolean => {
    const { SYNC_INTERVAL } = VALID_RANGES;
    return isNumber(value) && value >= SYNC_INTERVAL.min && value <= SYNC_INTERVAL.max;
  },

  /**
   * Check if number is within valid rate limit range
   */
  isValidRateLimit: (value: number): boolean => {
    const { RATE_LIMIT } = VALID_RANGES;
    return isNumber(value) && value >= RATE_LIMIT.min && value <= RATE_LIMIT.max;
  },

  /**
   * Check if rating is valid (1-5)
   */
  isValidRating: (value: number): boolean => {
    const { RATING } = VALID_RANGES;
    return isNumber(value) && value >= RATING.min && value <= RATING.max;
  },

  /**
   * Check if price is valid
   */
  isValidPrice: (value: number): boolean => {
    const { PRICE } = VALID_RANGES;
    return isNumber(value) && value >= PRICE.min && value <= PRICE.max;
  },
} as const;
