import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { RateLimitConfig, RATE_LIMIT_PRESETS } from './rate-limit.config';
import { RateLimitGuard } from './rate-limit.guard';

export const RATE_LIMIT_META = 'RATE_LIMIT_CONFIG';

/**
 * Attach rate limiting to a controller or individual route handler.
 *
 * @example
 * // Use a preset
 * @RateLimit('AUTH')
 * @Post('login')
 * login() {}
 *
 * @example
 * // Custom config
 * @RateLimit({ limit: 10, windowMs: 60_000, strategy: 'ip' })
 * @Post('upload')
 * upload() {}
 *
 * @example
 * // Whole controller
 * @RateLimit('API')
 * @Controller('events')
 * export class EventsController {}
 */
export function RateLimit(
  configOrPreset: keyof typeof RATE_LIMIT_PRESETS | Partial<RateLimitConfig> = 'API',
) {
  const config: RateLimitConfig =
    typeof configOrPreset === 'string'
      ? (RATE_LIMIT_PRESETS[configOrPreset] as RateLimitConfig)
      : {
          limit:     60,
          windowMs:  60_000,
          strategy:  'ip',
          message:   'Too many requests.',
          ...configOrPreset,
        };

  return applyDecorators(
    SetMetadata(RATE_LIMIT_META, config),
    UseGuards(RateLimitGuard),
  );
}

/** Explicitly disable rate limiting on a handler inside a rate-limited controller */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_META, null);