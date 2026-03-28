import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../rate-limit.service';
import { RATE_LIMIT_CONFIG_KEY } from '../rate-limit.decorator';
import { RateLimitMonitoringService } from '../services/rate-limit-monitoring.service';
import { UserTierRateLimitService } from '../services/user-tier-rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
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

    const config = this.reflector.get(RATE_LIMIT_CONFIG_KEY, context.getHandler()) ||
                   this.reflector.get(RATE_LIMIT_CONFIG_KEY, context.getClass());

    if (config?.skip && config.skip(request)) {
      return true;
    }

    const user = request.user;
    const ip = this.extractIp(request);

    try {
      // Get user tier and adjust config accordingly
      const userTier = this.userTierService.getUserTier(user);
      const adjustedConfig = this.userTierService.getAdjustedConfig(config, userTier);

      const result = await this.rateLimitService.check(request, adjustedConfig);

      response.setHeader('X-RateLimit-Limit', result.limit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
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
          config?.message || 'Too many requests. Please try again later.',
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
