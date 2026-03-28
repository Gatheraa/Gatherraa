# Rate Limiting Policies

## Overview

This document outlines the rate limiting policies implemented in the Gatheraa application to protect against abuse, ensure fair usage, and maintain system stability.

## Rate Limiting Strategy

### Implementation Approach

The application uses a multi-layered rate limiting approach:

1. **Global Rate Limiting**: Applied at the application level using NestJS throttler
2. **Endpoint-Specific Rate Limiting**: Applied to critical operations using decorators
3. **User Tier-Based Rate Limiting**: Adjusted based on user subscription level
4. **IP-Based Rate Limiting**: Protection against anonymous abuse

### Rate Limiting Mechanisms

- **In-Memory Store**: For development and single-instance deployments
- **Redis Store**: For distributed deployments and horizontal scaling
- **Sliding Window Algorithm**: Ensures fair request distribution
- **Fail-Open Strategy**: Allows requests if rate limiting service fails

## Rate Limit Tiers

### Free Tier
- **Requests**: 60 per minute
- **Strategy**: IP-based
- **Endpoints**: All public endpoints
- **Message**: "Free tier rate limit exceeded. Upgrade for higher limits."

### Basic Tier
- **Requests**: 150 per minute
- **Strategy**: IP + User-based
- **Endpoints**: All authenticated endpoints
- **Message**: "Basic tier rate limit exceeded."

### Premium Tier
- **Requests**: 500 per minute
- **Strategy**: User-based only
- **Endpoints**: All endpoints including premium features
- **Message**: "Premium tier rate limit exceeded."

### Enterprise Tier
- **Requests**: 2000 per minute
- **Strategy**: User-based only
- **Endpoints**: All endpoints including enterprise features
- **Message**: "Enterprise tier rate limit exceeded."

## Endpoint-Specific Limits

### Authentication Endpoints (`/auth/*`)
- **Nonce Generation**: 5 requests per 15 minutes
- **Login**: 5 requests per 15 minutes
- **Token Refresh**: 10 requests per 15 minutes
- **Wallet Linking**: 5 requests per 15 minutes
- **Strategy**: IP-based
- **Rationale**: Prevent brute force attacks

### Payment Endpoints (`/payments/*`)
- **Payment Creation**: 10 requests per minute
- **Stripe Initiation**: 10 requests per minute
- **Stripe Confirmation**: 10 requests per minute
- **Crypto Initiation**: 10 requests per minute
- **Crypto Verification**: 60 requests per minute
- **Refund Processing**: 10 requests per minute
- **Strategy**: User + IP-based
- **Rationale**: Prevent financial abuse and fraud

### Public Endpoints
- **Event Listings**: 120 requests per minute
- **Search**: 100 requests per minute
- **Public Data**: 120 requests per minute
- **Strategy**: IP-based
- **Rationale**: Allow reasonable public access

### Expensive Operations
- **File Uploads**: 10 requests per minute
- **Email Sending**: 20 requests per minute
- **Report Generation**: 5 requests per minute
- **Data Export**: 10 requests per minute
- **Strategy**: User + IP-based
- **Rationale**: Limit resource-intensive operations

## Rate Limit Headers

All rate-limited responses include the following headers:

- `X-RateLimit-Limit`: The rate limit ceiling for the endpoint
- `X-RateLimit-Remaining`: The number of requests remaining in the current window
- `X-RateLimit-Reset`: The time when the rate limit window resets (Unix timestamp)

## Monitoring and Alerting

### Violation Logging

Rate limit violations are automatically logged with the following information:

- User ID (if authenticated)
- IP address
- Endpoint accessed
- User agent
- Timestamp
- Retry-after duration
- User tier
- Rate limit configuration

### Pattern Detection

The system automatically detects suspicious patterns:

- **High-Frequency IP**: Single IP with >50 violations in 5 minutes
- **Distributed Attack**: >100 unique IPs with >500 total violations
- **Endpoint Abuse**: Single endpoint with >100 violations

### Monitoring Integration

Rate limit data is sent to:

- **Elasticsearch**: For log aggregation and analysis
- **Sentry**: For error tracking and alerting
- **Custom Analytics**: For business intelligence

## Rate Limit Bypass

### Health Checks
Health check endpoints automatically bypass rate limiting to ensure monitoring systems work properly.

### Admin Users
Users with administrative roles may have elevated rate limits based on configuration.

### API Keys
Service-to-service communication using API keys may have custom rate limits.

## Configuration

### Environment Variables

```bash
# Rate Limiting Configuration
RATE_LIMIT_REDIS_URL=redis://localhost:6379
RATE_LIMIT_DEFAULT_LIMIT=60
RATE_LIMIT_DEFAULT_WINDOW_MS=60000
RATE_LIMIT_ENABLE_MONITORING=true
```

### Custom Configuration

Rate limits can be customized per endpoint using the `@RateLimit()` decorator:

```typescript
@RateLimit({
  limit: 100,
  windowMs: 60000,
  strategy: 'ip-and-user',
  message: 'Custom rate limit exceeded',
  skip: (req) => req.user?.isAdmin,
})
```

## Best Practices

### For Developers

1. **Apply Appropriate Limits**: Use the most restrictive preset that makes sense
2. **Consider Resource Cost**: Lower limits for expensive operations
3. **Document Limits**: Include rate limit information in API documentation
4. **Test Limits**: Include rate limiting in integration tests

### For Users

1. **Implement Exponential Backoff**: Retry failed requests with increasing delays
2. **Respect Headers**: Monitor rate limit headers to avoid hitting limits
3. **Use Efficient APIs**: Batch requests when possible
4. **Upgrade Tier**: Consider upgrading for higher limits

## Troubleshooting

### Common Issues

1. **429 Too Many Requests**: Rate limit exceeded
2. **Missing Headers**: Rate limit not properly configured
3. **Uneven Distribution**: Sliding window may cause temporary spikes

### Debugging

Enable debug logging to see rate limit decisions:

```bash
LOG_LEVEL=debug
```

## Future Enhancements

### Planned Features

1. **Adaptive Rate Limiting**: Dynamic limits based on system load
2. **Geographic Rate Limiting**: Different limits per region
3. **Machine Learning**: Anomaly detection for sophisticated attacks
4. **Rate Limit Dashboard**: UI for monitoring and management

### Performance Optimizations

1. **Distributed Counters**: Redis-based distributed rate limiting
2. **Caching**: Cache rate limit decisions for short periods
3. **Batch Processing**: Process rate limit updates in batches

## Security Considerations

### Attack Vectors

1. **Rate Limit Bypass**: Using multiple IPs or user accounts
2. **Resource Exhaustion**: Overwhelming the rate limiting system
3. **Header Manipulation**: Spoofing IP addresses

### Mitigations

1. **IP Reputation**: Block known malicious IPs
2. **Account Verification**: Require verified email for higher limits
3. **Circuit Breakers**: Temporarily block abusive patterns
4. **Rate Limit Analytics**: Monitor for coordinated attacks

## Compliance

### Data Protection

- Rate limit logs are retained according to data retention policies
- Personal data in logs is anonymized after retention period
- Users can request their rate limit data

### Regulatory Requirements

- GDPR compliance for EU users
- CCPA compliance for California users
- SOC 2 compliance for enterprise customers

## Support

For questions about rate limiting policies or to request limit adjustments:

- **Documentation**: [API Rate Limiting Guide](./api-rate-limiting.md)
- **Support**: support@gatheraa.com
- **Developer Forum**: [GitHub Discussions](https://github.com/Ardecrownn/Gatherraa/discussions)

---

*Last Updated: March 28, 2026*
*Version: 1.0.0*
