import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class VersioningMiddleware implements NestMiddleware {
  // Config for deprecated versions
  private readonly deprecations = {
    '1': {
      sunset: '2026-12-31T23:59:59Z',
      link: 'https://docs.gatherra.com/api/v1-deprecation',
    },
  };

  use(req: Request, res: Response, next: NextFunction) {
    const version = this.extractVersion(req);

    if (version && this.deprecations[version]) {
      const { sunset, link } = this.deprecations[version];
      
      // Add Deprecation and Sunset headers (RFC 8594 / Draft)
      res.setHeader('Deprecation', 'true');
      if (sunset) {
        res.setHeader('Sunset', sunset);
      }
      if (link) {
        res.setHeader('Link', `<${link}>; rel="deprecation"`);
      }

      // Add warning header
      res.setHeader('Warning', `299 - "Version ${version} is deprecated and will be sunset on ${sunset}"`);
    }

    // Version Analytics (could be sent to a service)
    req['apiVersion'] = version || 'default';
    
    next();
  }

  private extractVersion(req: Request): string | null {
    // 1. URL Versioning (v1, v2...)
    const urlMatch = req.url.match(/^\/v(\d+)\//);
    if (urlMatch) return urlMatch[1];

    // 2. Custom Header
    const headerVersion = req.headers['x-api-version'] as string;
    if (headerVersion) return headerVersion;

    // 3. Media Type (Accept Header)
    // Accept: application/vnd.gatherra.v1+json
    const acceptHeader = req.headers['accept'] as string;
    if (acceptHeader) {
      const match = acceptHeader.match(/vnd\.gatherra\.v(\d+)\+json/);
      if (match) return match[1];
    }

    return null;
  }
}
