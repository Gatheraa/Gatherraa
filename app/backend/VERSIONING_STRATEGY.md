# API Versioning Strategy

## Overview
Gatherra API uses a multi-layered versioning strategy to ensure backward compatibility while allowing the platform to evolve.

## Supported Strategies

### 1. URL Versioning (Recommended)
Prefix the API path with the version number.
- **Example**: `GET /v1/api/status`

### 2. Header Versioning
Include the `X-API-Version` header in your requests.
- **Example**: `X-API-Version: 2`

### 3. Media Type (Content Negotiation)
Include the version in the `Accept` header.
- **Example**: `Accept: application/vnd.gatherra.v2+json`

## Deprecation Policy
When a version is deprecated:
- The `Deprecation: true` header is returned.
- The `Sunset` header indicates when the version will be removed.
- A `Warning` header is included with details.
- A `Link` header points to the migration guide.

## Documentation
- **v1 Docs**: `/api/v1/docs`
- **v2 Docs**: `/api/v2/docs`
- **Unified Docs**: `/api/docs`
