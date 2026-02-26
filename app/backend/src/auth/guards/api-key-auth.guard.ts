import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    // In production, validate against stored API keys
    const validApiKeys = [
      process.env.ANALYTICS_API_KEY,
      'demo-api-key-12345',
      'test-api-key-67890'
    ].filter(Boolean);

    if (!apiKey) {
      return false;
    }

    return validApiKeys.includes(apiKey);
  }
}
