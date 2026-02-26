import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMIT_META } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Merge metadata from handler (more specific) then controller (fallback)
    const config = this.reflector.getAllAndOverride<RateLimitConfig | null>(
      RATE_LIMIT_META,
      [context.getHandler(), context.getClass()],
    );

    // null means @SkipRateLimit() was used
    if (config === null || config === undefined) return true;

    const req    = context.switchToHttp().getRequest();
    const res    = context.switchToHttp().getResponse();

    // Allow skip function defined in config
    if (config.skip?.(req)) return true;

    const result = await this.rateLimitService.check(req, config);

    // Always attach rate limit headers for transparency
    res.setHeader('X-RateLimit-Limit',     result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset',     Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);

      this.logger.warn(
        `Rate limit exceeded — ${req.method} ${req.path} ` +
        `[IP: ${req.ip}] [User: ${req.user?.id ?? 'anon'}]`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:    config.message ?? 'Too many requests.',
          retryAfter: result.retryAfter,
          resetAt:    result.resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}