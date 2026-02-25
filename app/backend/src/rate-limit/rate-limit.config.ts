export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Throttle by IP, authenticated user ID, or both */
  strategy: 'ip' | 'user' | 'ip-and-user';
  /** Human-readable message returned on 429 */
  message?: string;
  /** Skip rate limiting entirely (e.g. for health checks) */
  skip?: (req: any) => boolean;
}

/** Defaults applied when @RateLimit() is used without options */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000, // 1 minute
  strategy: 'ip',
  message: 'Too many requests. Please try again later.',
};

/** Presets for common route types */
export const RATE_LIMIT_PRESETS = {
  /** Strict: login, register, password reset */
  AUTH: {
    limit: 5,
    windowMs: 15 * 60_000, // 15 minutes
    strategy: 'ip',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  } satisfies RateLimitConfig,

  /** Standard API calls */
  API: {
    limit: 60,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Rate limit exceeded. Please slow down.',
  } satisfies RateLimitConfig,

  /** Public endpoints (search, listing) */
  PUBLIC: {
    limit: 120,
    windowMs: 60_000,
    strategy: 'ip',
    message: 'Too many requests.',
  } satisfies RateLimitConfig,

  /** Expensive operations (file upload, email sending) */
  EXPENSIVE: {
    limit: 10,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Operation rate limit reached. Please wait before retrying.',
  } satisfies RateLimitConfig,
} as const;