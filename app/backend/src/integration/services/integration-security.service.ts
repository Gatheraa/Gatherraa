import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../entities/integration.entity';

@Injectable()
export class IntegrationSecurityService {
  private readonly logger = new Logger(IntegrationSecurityService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
  ) {}

  async validateIntegrationConfig(integrationData: any): Promise<boolean> {
    this.logger.log(`Validating integration configuration for: ${integrationData.type}`);

    try {
      // Validate required fields based on integration type
      switch (integrationData.type) {
        case 'LMS':
          return this.validateLmsConfig(integrationData);
        case 'CRM':
          return this.validateCrmConfig(integrationData);
        case 'PAYMENT':
          return this.validatePaymentConfig(integrationData);
        default:
          return this.validateGenericConfig(integrationData);
      }
    } catch (error) {
      this.logger.error(`Configuration validation failed: ${error.message}`);
      return false;
    }
  }

  async encryptCredentials(credentials: Record<string, any>): Promise<string> {
    // This would implement proper encryption
    // For now, return a base64 encoded string (NOT SECURE - for demo only)
    const encrypted = Buffer.from(JSON.stringify(credentials)).toString('base64');
    return encrypted;
  }

  async decryptCredentials(encryptedCredentials: string): Promise<Record<string, any>> {
    // This would implement proper decryption
    // For now, decode base64 string (NOT SECURE - for demo only)
    const decrypted = Buffer.from(encryptedCredentials, 'base64').toString('utf-8');
    return JSON.parse(decrypted);
  }

  async validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): Promise<boolean> {
    const crypto = require('crypto');
    
    try {
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');

      // Remove any algorithm prefix from the incoming signature
      const cleanSignature = signature.replace(`${algorithm}=`, '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(cleanSignature, 'hex')
      );
    } catch (error) {
      this.logger.error(`Webhook signature validation failed: ${error.message}`);
      return false;
    }
  }

  async sanitizeData(data: any): Promise<any> {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = [
      'password',
      'apiKey',
      'apiSecret',
      'accessToken',
      'refreshToken',
      'privateKey',
      'secret',
      'token',
      'credential',
    ];

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = await this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async validateRateLimit(integrationId: string, requestCount: number, timeWindow: number): Promise<boolean> {
    // This would implement proper rate limiting with Redis or similar
    // For now, return true (allow all requests)
    return true;
  }

  async auditLogAccess(integrationId: string, userId: string, action: string, metadata?: any): Promise<void> {
    this.logger.log(`Audit log: User ${userId} performed ${action} on integration ${integrationId}`);
    
    // This would store audit logs in a secure, immutable storage
    // For now, just log to console
  }

  async checkCompliance(integrationId: string): Promise<{
    isCompliant: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for common compliance issues
    const integration = await this.integrationRepository.findOne({ where: { id: integrationId } });
    
    if (!integration) {
      return { isCompliant: false, violations: ['Integration not found'], recommendations: [] };
    }

    // Check if credentials are properly encrypted
    if (integration.credentials && typeof integration.credentials === 'object') {
      violations.push('Credentials are not encrypted');
      recommendations.push('Encrypt all sensitive credentials');
    }

    // Check if webhook secrets are configured
    if (integration.webhookEndpoints && integration.webhookEndpoints.length > 0) {
      if (!integration.configuration?.webhookSecret) {
        violations.push('Webhook endpoints configured without secret');
        recommendations.push('Configure webhook secrets for all endpoints');
      }
    }

    // Check rate limiting configuration
    if (!integration.rateLimitPerMinute || integration.rateLimitPerMinute > 1000) {
      violations.push('Rate limiting not properly configured');
      recommendations.push('Set appropriate rate limits to prevent abuse');
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      recommendations,
    };
  }

  private validateLmsConfig(integrationData: any): boolean {
    const required = ['baseUrl'];
    const hasRequired = required.every(field => integrationData.configuration?.[field]);
    
    if (!hasRequired) {
      throw new Error(`Missing required LMS configuration fields: ${required.join(', ')}`);
    }

    // Validate URL format
    try {
      new URL(integrationData.configuration.baseUrl);
    } catch {
      throw new Error('Invalid baseUrl format');
    }

    return true;
  }

  private validateCrmConfig(integrationData: any): boolean {
    const required = ['baseUrl', 'apiKey'];
    const hasRequired = required.every(field => integrationData.credentials?.[field]);
    
    if (!hasRequired) {
      throw new Error(`Missing required CRM configuration fields: ${required.join(', ')}`);
    }

    return true;
  }

  private validatePaymentConfig(integrationData: any): boolean {
    const required = ['apiKey', 'secretKey'];
    const hasRequired = required.every(field => integrationData.credentials?.[field]);
    
    if (!hasRequired) {
      throw new Error(`Missing required payment configuration fields: ${required.join(', ')}`);
    }

    return true;
  }

  private validateGenericConfig(integrationData: any): boolean {
    // Basic validation for generic integrations
    if (!integrationData.name || integrationData.name.trim().length === 0) {
      throw new Error('Integration name is required');
    }

    if (!integrationData.type) {
      throw new Error('Integration type is required');
    }

    return true;
  }
}
