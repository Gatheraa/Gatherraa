# Migration Guide: v1 to v2

## Summary
API v2 introduces several breaking changes and optimizations. This guide helps you transition from v1 to v2.

## Major Changes
- **Endpoint Structure**: All endpoints are now versioned.
- **Data Formats**: v2 uses more efficient data structures for responses.
- **Performance**: v2 endpoints are optimized for lower latency.

## Steps to Migrate
1. **Update Base URL**: Change `https://api.gatherra.com/v1/` to `https://api.gatherra.com/v2/`.
2. **Update Headers**: If using header-based versioning, update `X-API-Version` to `2`.
3. **Handle Response Changes**: Review the Swagger documentation at `/api/v2/docs` for model changes.

## Timeline
- **v1 Deprecation**: 2026-03-24
- **v1 Sunset**: 2026-12-31
