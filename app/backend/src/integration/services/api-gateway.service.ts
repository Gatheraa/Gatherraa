import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Integration, IntegrationType } from '../entities/integration.entity';
import { IntegrationLog, LogLevel, LogCategory } from '../entities/integration-log.entity';
import { IntegrationMetrics, MetricType } from '../entities/integration-metrics.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ApiGatewayService {
  private readonly logger = new Logger(ApiGatewayService.name);
  private readonly rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(IntegrationMetrics)
    private readonly metricsRepository: Repository<IntegrationMetrics>,
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
  ) {}

  async makeApiCall(
    integration: Integration,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    headers?: Record<string, string>,
  ): Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check rate limiting
      await this.checkRateLimit(integration);

      // Prepare request
      const url = this.buildUrl(integration, endpoint);
      const requestHeaders = this.buildHeaders(integration, headers);

      this.logger.log(`Making API call for integration ${integration.id}: ${method} ${url}`);

      // Make the HTTP request
      const response = await this.executeHttpRequest(url, method, data, requestHeaders);

      const duration = Date.now() - startTime;

      // Log successful request
      await this.logApiCall(integration.id, requestId, method, endpoint, duration, response.status, true);

      // Track metrics
      await this.trackApiMetrics(integration.id, duration, response.status, true);

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed request
      await this.logApiCall(integration.id, requestId, method, endpoint, duration, error.response?.status, false, error.message);

      // Track metrics
      await this.trackApiMetrics(integration.id, duration, error.response?.status || 500, false);

      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status,
      };
    }
  }

  async authenticateRequest(integration: Integration, request: any): Promise<boolean> {
    try {
      switch (integration.type) {
        case IntegrationType.LMS:
          return await this.authenticateLmsRequest(integration, request);
        case IntegrationType.CRM:
          return await this.authenticateCrmRequest(integration, request);
        default:
          return await this.authenticateGenericRequest(integration, request);
      }
    } catch (error) {
      this.logger.error(`Authentication failed for integration ${integration.id}: ${error.message}`);
      return false;
    }
  }

  async validateWebhookSignature(
    integration: Integration,
    payload: string,
    signature: string,
    secret?: string,
  ): Promise<boolean> {
    try {
      const webhookSecret = secret || integration.configuration?.webhookSecret;
      
      if (!webhookSecret) {
        this.logger.warn(`No webhook secret configured for integration ${integration.id}`);
        return false;
      }

      // This would implement proper signature verification based on the provider
      // For now, we'll implement a basic HMAC verification
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Webhook signature validation failed: ${error.message}`);
      return false;
    }
  }

  async refreshTokenIfNeeded(integration: Integration): Promise<Integration> {
    const tokenExpiry = integration.credentials?.expiresAt;
    
    if (!tokenExpiry) {
      return integration;
    }

    const now = new Date();
    const expiryDate = new Date(tokenExpiry);
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry

    if (expiryDate.getTime() - now.getTime() < refreshThreshold) {
      this.logger.log(`Refreshing token for integration ${integration.id}`);
      
      try {
        const newCredentials = await this.performTokenRefresh(integration);
        
        integration.credentials = {
          ...integration.credentials,
          ...newCredentials,
        };

        // Note: In a real implementation, you would save this to the database
        // await this.integrationRepository.save(integration);

        await this.logTokenRefresh(integration.id, true);
      } catch (error) {
        await this.logTokenRefresh(integration.id, false, error.message);
        throw error;
      }
    }

    return integration;
  }

  private async checkRateLimit(integration: Integration): Promise<void> {
    const key = `integration:${integration.id}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    const current = this.rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return;
    }

    if (current.count >= integration.rateLimitPerMinute) {
      throw new Error(`Rate limit exceeded for integration ${integration.id}`);
    }

    current.count++;
  }

  private buildUrl(integration: Integration, endpoint: string): string {
    const baseUrl = integration.configuration?.baseUrl || '';
    return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  }

  private buildHeaders(integration: Integration, additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Gatheraa-Integration/1.0',
      ...additionalHeaders,
    };

    // Add authentication headers based on integration type
    if (integration.credentials?.apiKey) {
      headers['Authorization'] = `Bearer ${integration.credentials.apiKey}`;
    }

    if (integration.credentials?.accessToken) {
      headers['Authorization'] = `Bearer ${integration.credentials.accessToken}`;
    }

    return headers;
  }

  private async executeHttpRequest(
    url: string,
    method: string,
    data?: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    // This would use a proper HTTP client like axios
    // For now, we'll simulate the request
    const fetch = require('node-fetch');

    const options: any = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    return {
      status: response.status,
      data: responseData,
    };
  }

  private async authenticateLmsRequest(integration: Integration, request: any): Promise<boolean> {
    // Implement LMS-specific authentication
    const apiKey = request.headers['x-api-key'];
    return apiKey === integration.credentials?.apiKey;
  }

  private async authenticateCrmRequest(integration: Integration, request: any): Promise<boolean> {
    // Implement CRM-specific authentication
    const authToken = request.headers['authorization'];
    return authToken === `Bearer ${integration.credentials?.accessToken}`;
  }

  private async authenticateGenericRequest(integration: Integration, request: any): Promise<boolean> {
    // Implement generic authentication
    return true;
  }

  private async performTokenRefresh(integration: Integration): Promise<any> {
    // This would implement token refresh logic based on the integration type
    // For now, we'll return a mock response
    return {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };
  }

  private async logApiCall(
    integrationId: string,
    requestId: string,
    method: string,
    endpoint: string,
    duration: number,
    statusCode: number,
    success: boolean,
    error?: string,
  ): Promise<void> {
    const log = this.logRepository.create({
      integrationId,
      requestId,
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      category: LogCategory.API_CALL,
      message: `API ${method} ${endpoint} - ${success ? 'Success' : 'Failed'} (${statusCode})`,
      metadata: {
        method,
        endpoint,
        duration,
        statusCode,
        success,
        error,
      },
    });

    await this.logRepository.save(log);
  }

  private async logTokenRefresh(integrationId: string, success: boolean, error?: string): Promise<void> {
    const log = this.logRepository.create({
      integrationId,
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      category: LogCategory.AUTHENTICATION,
      message: `Token refresh ${success ? 'successful' : 'failed'}`,
      metadata: {
        success,
        error,
      },
    });

    await this.logRepository.save(log);
  }

  private async trackApiMetrics(
    integrationId: string,
    duration: number,
    statusCode: number,
    success: boolean,
  ): Promise<void> {
    // Track API call count
    await this.metricsRepository.save({
      integrationId,
      metricType: MetricType.API_CALLS,
      period: 'MINUTE',
      value: 1,
      timestamp: new Date(),
      dimensions: {
        success: success.toString(),
        statusCode: statusCode.toString(),
      },
    });

    // Track response time
    await this.metricsRepository.save({
      integrationId,
      metricType: MetricType.RESPONSE_TIME,
      period: 'MINUTE',
      value: duration,
      unit: 'milliseconds',
      timestamp: new Date(),
    });

    // Track success/error rate
    await this.metricsRepository.save({
      integrationId,
      metricType: success ? MetricType.SUCCESS_RATE : MetricType.ERROR_RATE,
      period: 'MINUTE',
      value: 1,
      timestamp: new Date(),
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
