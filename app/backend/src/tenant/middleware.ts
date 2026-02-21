import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Try domain first: tenant1.example.com
    const host = req.headers.host || '';
    const domainTenant = host.split('.')[0];

    // Or fallback to X-Tenant-ID header
    const headerTenant = req.headers['x-tenant-id'] as string;

    const tenantId = headerTenant || domainTenant;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant not found' });
    }

    req['tenantId'] = tenantId;
    next();
  }
}