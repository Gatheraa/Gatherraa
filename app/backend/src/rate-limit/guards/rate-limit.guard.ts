import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitConfig, RATE_LIMIT_PRESETS } from '../rate-limit.config';
import { RateLimitService } from '../rate-limit.service';
import { RATE_LIMIT_CONFIG_KEY } from '../rate-limit.decorator';
import { RateLimitMonitoringService } from '../services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from '../services/user-tier-rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly RATE_LIMIT_APPLIED = Symbol('RATE_LIMIT_APPLIED');
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    private readonly monitoringService: RateLimitMonitoringService,
    private readonly userTierService: UserTierRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (request[RateLimitGuard.RATE_LIMIT_APPLIED]) {
      return true;
    }

    const config = this.reflector.getAllAndOverride<RateLimitConfig | null>(
      RATE_LIMIT_CONFIG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (config === null) {
      request[RateLimitGuard.RATE_LIMIT_APPLIED] = true;
      return true;
    }

    const effectiveConfig = config ?? RATE_LIMIT_PRESETS.API;

    if (effectiveConfig.skip?.(request)) {
      request[RateLimitGuard.RATE_LIMIT_APPLIED] = true;
      return true;
    }

    const user = request.user;
    const ip = this.extractIp(request);

    try {
      // Get user tier and adjust config accordingly
      const userTier = this.userTierService.getUserTier(user);
      const adjustedConfig = this.userTierService.getAdjustedConfig(
        effectiveConfig,
        userTier,
      );

      const result = await this.rateLimitService.check(request, adjustedConfig);
      request[RateLimitGuard.RATE_LIMIT_APPLIED] = true;

      response.setHeader('X-RateLimit-Limit', result.limit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        response.setHeader('Retry-After', result.retryAfter);

        this.logger.warn(`Rate limit exceeded for ${user?.id || ip} on ${request.method}:${request.path}`);
        
        await this.monitoringService.logRateLimitViolation(
          user?.id,
          ip,
          `${request.method}:${request.path}`,
          request.headers['user-agent'],
          result,
          userTier,
          adjustedConfig,
        );
        
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              adjustedConfig.message ||
              'Too many requests. Please try again later.',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

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
