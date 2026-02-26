import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AdvancedQuotaService } from '../services/advanced-quota.service';
import { ApiKeyManagementService } from '../services/api-key-management.service';
import { AdvancedDdosService } from '../services/advanced-ddos.service';
import { ApiUsageAnalyticsService } from '../services/api-usage-analytics.service';
import { ApiUsageLog } from '../entities/api-usage-log.entity';

@Injectable()
export class AdvancedRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AdvancedRateLimitMiddleware.name);

  constructor(
    private quotaService: AdvancedQuotaService,
    private apiKeyService: ApiKeyManagementService,
    private ddosService: AdvancedDdosService,
    private analyticsService: ApiUsageAnalyticsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const ipAddress = this.extractIpAddress(req);
    
    try {
      // DDoS protection first
      const ddosResult = await this.ddosService.analyzeRequest(
        ipAddress,
        req.path,
        req.headers['user-agent']
      );

      if (ddosResult.isBlocked) {
        this.logger.warn(`DDoS protection blocked IP: ${ipAddress}, Reason: ${ddosResult.reason}`);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'DDoS protection activated',
          retryAfter: ddosResult.blockDuration,
          threatLevel: ddosResult.threatLevel
        });
      }

      // Extract API key and user info
      const apiKey = this.extractApiKey(req);
      let userId = req.user?.id || req.user?.sub;
      let apiKeyId = null;
      let tier = 'FREE';

      if (apiKey) {
        const validation = await this.apiKeyService.validateApiKey(
          apiKey, 
          this.getRequiredPermission(req)
        );
        
        if (!validation.valid) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: validation.error
          });
        }

        userId = validation.apiKey.userId;
        apiKeyId = validation.apiKey.id;
        tier = validation.apiKey.tier;
      }

      // Check quota limits
      const quotaResult = await this.quotaService.checkQuota(
        userId,
        apiKeyId,
        req.path,
        tier as any
      );

      if (!quotaResult.allowed) {
        this.logger.warn(`Quota exceeded for user ${userId}, endpoint ${req.path}`);
        
        // Record the blocked request
        await this.recordRequest(req, {
          userId,
          apiKeyId,
          ipAddress,
          statusCode: 429,
          responseTime: Date.now() - startTime,
          cost: quotaResult.cost || 0,
          isRateLimited: true,
          isBlocked: false
        });

        return res.status(429).json({
          error: 'Quota Exceeded',
          message: 'API quota limit exceeded',
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetAt: quotaResult.resetAt,
          overage: quotaResult.overage,
          retryAfter: Math.ceil((quotaResult.resetAt.getTime() - Date.now()) / 1000)
        });
      }

      // Request throttling for expensive operations
      if (this.isExpensiveOperation(req)) {
        const throttleResult = await this.throttleExpensiveOperation(
          userId,
          apiKeyId,
          req.path
        );

        if (!throttleResult.allowed) {
          return res.status(429).json({
            error: 'Operation Throttled',
            message: 'Expensive operation is throttled',
            retryAfter: throttleResult.retryAfter,
            queuePosition: throttleResult.queuePosition
          });
        }
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', quotaResult.limit);
      res.setHeader('X-RateLimit-Remaining', quotaResult.remaining);
      res.setHeader('X-RateLimit-Reset', quotaResult.resetAt.toISOString());
      res.setHeader('X-RateLimit-Overage', quotaResult.overage || 0);

      // Continue to the next middleware
      res.on('finish', async () => {
        const responseTime = Date.now() - startTime;
        
        // Record the request for analytics
        await this.recordRequest(req, {
          userId,
          apiKeyId,
          ipAddress,
          statusCode: res.statusCode,
          responseTime,
          cost: quotaResult.cost || 0,
          isRateLimited: false,
          isBlocked: false
        });
      });

      next();

    } catch (error) {
      this.logger.error(`Rate limiting middleware error: ${error.message}`, error.stack);
      
      // Record the error
      await this.recordRequest(req, {
        userId,
        apiKeyId,
        ipAddress,
        statusCode: 500,
        responseTime: Date.now() - startTime,
        cost: 0,
        errorMessage: error.message,
        isRateLimited: false,
        isBlocked: false
      });

      next(error);
    }
  }

  /**
   * Record API usage for analytics
   */
  private async recordRequest(
    req: Request,
    usageData: Partial<ApiUsageLog>
  ): Promise<void> {
    try {
      await this.analyticsService.recordUsage({
        ...usageData,
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        apiVersion: req.headers['api-version'],
        requestHeaders: this.sanitizeHeaders(req.headers),
        rateLimitTier: usageData.apiKeyId ? 'API_KEY' : 'ANONYMOUS'
      });
    } catch (error) {
      this.logger.error(`Failed to record usage: ${error.message}`);
    }
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(req: Request): string {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.headers['x-real-ip']?.toString() ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * Extract API key from request
   */
  private extractApiKey(req: Request): string | null {
    // Try Authorization header first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.toString().startsWith('Bearer ')) {
      return authHeader.toString().substring(7);
    }

    // Try X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      return apiKeyHeader.toString();
    }

    // Try query parameter
    if (req.query && req.query['api_key']) {
      return req.query['api_key'] as string;
    }

    return null;
  }

  /**
   * Get required permission for the endpoint
   */
  private getRequiredPermission(req: Request): string {
    const path = req.path;
    const method = req.method.toUpperCase();

    // Simple permission mapping
    if (path.startsWith('/api/v1/analytics')) {
      return 'analytics:read';
    }
    if (path.startsWith('/api/v1/reports')) {
      return method === 'GET' ? 'reports:read' : 'reports:write';
    }
    if (path.startsWith('/api/v1/admin')) {
      return 'admin:access';
    }

    return 'api:access';
  }

  /**
   * Check if operation is expensive
   */
  private isExpensiveOperation(req: Request): boolean {
    const expensivePaths = [
      '/api/v1/analytics/export',
      '/api/v1/reports/generate',
      '/api/v1/admin/backup',
      '/api/v1/admin/maintenance'
    ];

    const expensiveMethods = ['POST', 'PUT', 'DELETE'];
    
    return expensivePaths.some(path => req.path.startsWith(path)) ||
           expensiveMethods.includes(req.method.toUpperCase());
  }

  /**
   * Throttle expensive operations
   */
  private async throttleExpensiveOperation(
    userId: string,
    apiKeyId: string,
    endpoint: string
  ): Promise<{
    allowed: boolean;
    retryAfter: number;
    queuePosition?: number;
  }> {
    // Simple implementation - in production, use a proper queue system
    const redis = require('ioredis');
    const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    const key = `throttle:${userId}:${endpoint}`;
    const current = await redisClient.get(key);
    
    if (current && parseInt(current) > 0) {
      return {
        allowed: false,
        retryAfter: 30, // 30 seconds
        queuePosition: parseInt(current)
      };
    }

    // Set throttle for 30 seconds
    await redisClient.setex(key, 30, '1');
    
    return {
      allowed: true,
      retryAfter: 0
    };
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: any): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const [key, value] of Object.entries(headers)) {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = value;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
