import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../rate-limit.service';
import { RATE_LIMIT_CONFIG_KEY } from '../rate-limit.decorator';
import { RateLimitMonitoringService } from '../services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from '../services/user-tier-rate-limit.service';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';
import { DEFAULT_RATE_LIMIT_CONFIG } from '../rate-limit.config';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    private readonly monitoringService: RateLimitMonitoringService,
    private readonly userTierService: UserTierRateLimitService,
    @Optional() private readonly metricsService?: RateLimitMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Check metadata from handler first, then class
    const config =
      this.reflector.get(RATE_LIMIT_CONFIG_KEY, context.getHandler()) ??
      this.reflector.get(RATE_LIMIT_CONFIG_KEY, context.getClass());

    // Explicit null metadata from @SkipRateLimit() or config.skip() evaluation
    if (config === null) {
      return true;
    }

    if (config?.skip && config.skip(request)) {
      return true;
    }

    const user = request.user;
    const ip = this.extractIp(request);
    const endpoint = `${request.method}:${request.route?.path ?? request.path ?? 'unknown'}`;

    try {
      const baseConfig = config ?? DEFAULT_RATE_LIMIT_CONFIG;
      const userTier = this.userTierService.getUserTier(user);
      const adjustedConfig = this.userTierService.getAdjustedConfig(baseConfig, userTier);

      const result = await this.rateLimitService.check(request, adjustedConfig);

      if (response && typeof response.setHeader === 'function') {
        response.setHeader('X-RateLimit-Limit', result.limit);
        response.setHeader('X-RateLimit-Remaining', result.remaining);
        response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      }

      if (!result.allowed) {
        if (response && typeof response.setHeader === 'function') {
          response.setHeader('Retry-After', result.retryAfter);
        }

        this.logger.warn(`Rate limit exceeded for ${user?.id || ip} on ${endpoint}`);

        this.metricsService?.recordViolation(endpoint, userTier, adjustedConfig.strategy);
        this.metricsService?.setRemaining(endpoint, ip, 0);

        await this.monitoringService.logRateLimitViolation(
          user?.id,
          ip,
          endpoint,
          request.headers?.['user-agent'],
          result,
          userTier,
          adjustedConfig,
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: adjustedConfig.message || 'Too many requests. Please try again later.',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.metricsService?.recordHit(endpoint, userTier, true);
      this.metricsService?.setRemaining(endpoint, ip, result.remaining);

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Rate limiting error:', error);
      return true;
    }
  }

  private extractIp(request: any): string {
    return (
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      request.headers?.['x-real-ip'] ??
      request.socket?.remoteAddress ??
      request.ip ??
      'unknown'
    );
  }
}
