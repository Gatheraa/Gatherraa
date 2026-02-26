import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { differenceInYears, format } from 'date-fns';

export interface AnonymizationOptions {
  method: 'hash' | 'tokenization' | 'masking' | 'generalization' | 'suppression';
  preserveFormat?: boolean;
  salt?: string;
  reversible?: boolean;
  key?: string;
}

export interface AnonymizationResult {
  original: string;
  anonymized: string;
  method: string;
  reversible: boolean;
  riskScore: number;
}

export interface DataField {
  name: string;
  value: any;
  type: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  category: 'personal' | 'special' | 'financial' | 'health' | 'biometric' | 'location';
}

@Injectable()
export class DataAnonymizationService {
  private readonly logger = new Logger(DataAnonymizationService.name);
  private readonly tokenStore = new Map<string, string>();
  private readonly salt = randomBytes(32).toString('hex');

  /**
   * Anonymize a single value
   */
  anonymizeValue(value: any, options: AnonymizationOptions): AnonymizationResult {
    if (value === null || value === undefined) {
      return {
        original: value,
        anonymized: value,
        method: options.method,
        reversible: false,
        riskScore: 0,
      };
    }

    const stringValue = String(value);
    let anonymized: string;
    let reversible = options.reversible || false;

    switch (options.method) {
      case 'hash':
        anonymized = this.hashValue(stringValue, options.salt || this.salt);
        reversible = false;
        break;

      case 'tokenization':
        anonymized = this.tokenizeValue(stringValue, options.key);
        reversible = true;
        break;

      case 'masking':
        anonymized = this.maskValue(stringValue, options.preserveFormat);
        reversible = false;
        break;

      case 'generalization':
        anonymized = this.generalizeValue(stringValue, options.preserveFormat);
        reversible = false;
        break;

      case 'suppression':
        anonymized = this.suppressValue(stringValue);
        reversible = false;
        break;

      default:
        anonymized = this.hashValue(stringValue, this.salt);
        reversible = false;
    }

    return {
      original: stringValue,
      anonymized,
      method: options.method,
      reversible,
      riskScore: this.calculateRiskScore(stringValue, anonymized, options.method),
    };
  }

  /**
   * Anonymize an entire object
   */
  anonymizeObject(obj: any, fieldConfig: Record<string, AnonymizationOptions>): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const result = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = this.anonymizeObject(value, fieldConfig);
      } else if (fieldConfig[key]) {
        const anonymizationResult = this.anonymizeValue(value, fieldConfig[key]);
        result[key] = anonymizationResult.anonymized;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Hash a value using SHA-256 with salt
   */
  private hashValue(value: string, salt: string): string {
    return createHash('sha256').update(value + salt).digest('hex');
  }

  /**
   * Tokenize a value (reversible)
   */
  private tokenizeValue(value: string, key?: string): string {
    const tokenKey = key || this.generateTokenKey();
    const token = randomBytes(16).toString('hex');
    
    // Store the mapping for potential de-tokenization
    this.tokenStore.set(token, value);
    
    return `token_${token}`;
  }

  /**
   * De-tokenize a value
   */
  detokenizeValue(token: string): string | null {
    if (!token.startsWith('token_')) {
      return null;
    }

    const actualToken = token.substring(6);
    return this.tokenStore.get(actualToken) || null;
  }

  /**
   * Mask a value while preserving format
   */
  private maskValue(value: string, preserveFormat = true): string {
    if (!preserveFormat) {
      return '*'.repeat(value.length);
    }

    // Email masking
    if (value.includes('@')) {
      const [local, domain] = value.split('@');
      if (local.length <= 2) {
        return `${local[0]}*@${domain}`;
      }
      return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
    }

    // Phone masking
    if (/^\+?[\d\s\-\(\)]+$/.test(value)) {
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 4) {
        return '*'.repeat(digits.length);
      }
      return value.slice(0, -4).replace(/\d/g, '*') + digits.slice(-4);
    }

    // Credit card masking
    if (/^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(value.replace(/\s/g, ''))) {
      const clean = value.replace(/\D/g, '');
      return `${clean.slice(0, 4)} ${'*'.repeat(clean.length - 8)} ${clean.slice(-4)}`;
    }

    // General string masking
    if (value.length <= 2) {
      return '*'.repeat(value.length);
    }
    return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
  }

  /**
   * Generalize a value (reduce precision)
   */
  private generalizeValue(value: string, preserveFormat = true): string {
    // Date generalization
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(value)) {
      const date = new Date(value);
      return format(date, 'yyyy-MM'); // Only keep year and month
    }

    // Age generalization
    const ageRegex = /^\d+$/;
    if (ageRegex.test(value)) {
      const age = parseInt(value);
      if (age < 18) return '<18';
      if (age < 25) return '18-24';
      if (age < 35) return '25-34';
      if (age < 45) return '35-44';
      if (age < 55) return '45-54';
      if (age < 65) return '55-64';
      return '65+';
    }

    // Location generalization (postal codes)
    const postalRegex = /^\d{5}(-\d{4})?$/;
    if (postalRegex.test(value)) {
      return value.substring(0, 3) + '**';
    }

    // IP address generalization
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(value)) {
      const parts = value.split('.');
      return `${parts[0]}.${parts[1]}.*.*`;
    }

    return value;
  }

  /**
   * Suppress a value completely
   */
  private suppressValue(value: string): string {
    return '[REDACTED]';
  }

  /**
   * Calculate re-identification risk score
   */
  private calculateRiskScore(original: string, anonymized: string, method: string): number {
    let risk = 0;

    // Base risk by method
    const methodRisk = {
      hash: 10,
      tokenization: 30,
      masking: 40,
      generalization: 60,
      suppression: 5,
    };

    risk = methodRisk[method] || 50;

    // Adjust based on value characteristics
    if (original.length < 5) risk += 20; // Short values are easier to re-identify
    if (original === anonymized) risk += 30; // No change
    if (this.isUniqueIdentifier(original)) risk += 25;

    // Adjust based on anonymization quality
    const entropy = this.calculateEntropy(anonymized);
    if (entropy < 2) risk += 15; // Low entropy
    if (entropy > 4) risk -= 10; // High entropy

    return Math.max(0, Math.min(100, risk));
  }

  /**
   * Calculate entropy of a string
   */
  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Check if a value is likely a unique identifier
   */
  private isUniqueIdentifier(value: string): boolean {
    // Social Security Number pattern
    if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return true;
    
    // Driver's license pattern (simplified)
    if (/^[A-Z]\d{7,8}$/.test(value)) return true;
    
    // Passport pattern (simplified)
    if (/^[A-Z]{2}\d{7}$/.test(value)) return true;
    
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true;

    return false;
  }

  /**
   * Generate a token key
   */
  private generateTokenKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Pseudonymize data (reversible anonymization)
   */
  pseudonymize(data: any, fields: string[], key?: string): any {
    const pseudonymizationConfig: Record<string, AnonymizationOptions> = {};
    
    for (const field of fields) {
      pseudonymizationConfig[field] = {
        method: 'tokenization',
        reversible: true,
        key,
      };
    }

    return this.anonymizeObject(data, pseudonymizationConfig);
  }

  /**
   * De-pseudonymize data
   */
  depseudonymize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = this.depseudonymize(value);
      } else if (typeof value === 'string' && value.startsWith('token_')) {
        const original = this.detokenizeValue(value);
        result[key] = original || value;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Apply differential privacy noise
   */
  applyDifferentialPrivacy(value: number, epsilon: number = 1.0): number {
    if (epsilon <= 0) {
      throw new Error('Epsilon must be positive');
    }

    // Laplace mechanism for differential privacy
    const sensitivity = 1; // Assuming sensitivity of 1
    const scale = sensitivity / epsilon;
    
    // Generate Laplace noise
    const uniform = Math.random() - 0.5;
    const noise = -scale * Math.sign(uniform) * Math.log(1 - 2 * Math.abs(uniform));
    
    return value + noise;
  }

  /**
   * K-anonymity check
   */
  checkKAnonymity(dataset: any[], quasiIdentifiers: string[], k: number = 5): boolean {
    const groups = new Map<string, number>();

    for (const record of dataset) {
      const key = quasiIdentifiers.map(field => record[field]).join('|');
      groups.set(key, (groups.get(key) || 0) + 1);
    }

    for (const count of groups.values()) {
      if (count < k) {
        return false;
      }
    }

    return true;
  }

  /**
   * L-diversity check
   */
  checkLDiversity(dataset: any[], quasiIdentifiers: string[], sensitiveAttribute: string, l: number = 3): boolean {
    const groups = new Map<string, Set<any>>();

    for (const record of dataset) {
      const key = quasiIdentifiers.map(field => record[field]).join('|');
      if (!groups.has(key)) {
        groups.set(key, new Set());
      }
      groups.get(key)!.add(record[sensitiveAttribute]);
    }

    for (const values of groups.values()) {
      if (values.size < l) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get anonymization recommendations
   */
  getAnonymizationRecommendations(fields: DataField[]): Record<string, AnonymizationOptions> {
    const recommendations: Record<string, AnonymizationOptions> = {};

    for (const field of fields) {
      switch (field.sensitivity) {
        case 'critical':
          recommendations[field.name] = {
            method: 'suppression',
            reversible: false,
          };
          break;

        case 'high':
          if (field.category === 'personal') {
            recommendations[field.name] = {
              method: 'tokenization',
              reversible: true,
            };
          } else {
            recommendations[field.name] = {
              method: 'hash',
              reversible: false,
            };
          }
          break;

        case 'medium':
          recommendations[field.name] = {
            method: 'masking',
            reversible: false,
            preserveFormat: true,
          };
          break;

        case 'low':
          recommendations[field.name] = {
            method: 'generalization',
            reversible: false,
            preserveFormat: true,
          };
          break;
      }
    }

    return recommendations;
  }
}
