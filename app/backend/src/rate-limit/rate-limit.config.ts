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

  /** Auth token refresh */
  AUTH_REFRESH: {
    limit: 10,
    windowMs: 15 * 60_000, // 15 minutes
    strategy: 'ip',
    message: 'Too many refresh attempts. Please try again in 15 minutes.',
  } satisfies RateLimitConfig,

  /** Payment operations */
  PAYMENT: {
    limit: 10,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Payment rate limit exceeded. Please wait before retrying.',
  } satisfies RateLimitConfig,

  /** Payment crypto verification */
  PAYMENT_CRYPTO_VERIFY: {
    limit: 60,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Crypto verification rate limit exceeded.',
  } satisfies RateLimitConfig,

  /** Standard API calls */
  API: {
    limit: 60,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Rate limit exceeded. Please slow down.',
  } satisfies RateLimitConfig,

  /** Public endpoints (listings, public data) */
  PUBLIC: {
    limit: 120,
    windowMs: 60_000,
    strategy: 'ip',
    message: 'Too many requests.',
  } satisfies RateLimitConfig,

  /** Search endpoints */
  SEARCH: {
    limit: 100,
    windowMs: 60_000,
    strategy: 'ip',
    message: 'Search rate limit exceeded.',
  } satisfies RateLimitConfig,

  /** Expensive operations (file uploads, exports) */
  EXPENSIVE: {
    limit: 10,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Operation rate limit reached. Please wait before retrying.',
  } satisfies RateLimitConfig,

  /** Email notifications sending */
  EMAIL: {
    limit: 20,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Email sending rate limit reached.',
  } satisfies RateLimitConfig,

  /** Report generation */
  REPORT_GEN: {
    limit: 5,
    windowMs: 60_000,
    strategy: 'ip-and-user',
    message: 'Report generation rate limit reached.',
  } satisfies RateLimitConfig,
} as const;