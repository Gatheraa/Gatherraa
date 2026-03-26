import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../services/audit.service';
import { AUDIT_METADATA_KEY } from '../decorators/audit.decorator';
import { AuditAction } from '../constants/audit.constants';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditData = this.reflector.get<{ action?: string; entityName?: string }>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    // If audit data is not found, skip auditing for this route
    if (!auditData) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url, ip, user } = request;
    const userAgent = request.get('user-agent');

    // For POST/PUT/DELETE, we want to capture the request body as newValue if not sensitive
    const oldValue = request.body?._preUpdateState || null; // Optional: system can inject current state for updates
    const newValue = request.body || null;

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Perform logging after successful request execution
          this.auditService
            .logEvent({
              userId: user?.id || 'anonymous',
              action: auditData.action || this.mapMethodToAction(method),
              entityName: auditData.entityName || this.guessEntityFromUrl(url),
              entityId: request.params?.id || data?.id || null,
              oldValue,
              newValue: this.sanitizeData(newValue),
              metadata: {
                ipAddress: ip,
                userAgent,
                requestMethod: method,
                requestUrl: url,
                status: context.switchToHttp().getResponse().statusCode,
              },
            })
            .catch((err) => {
              this.logger.error(`Failed to log audit event: ${err.message}`);
            });
        },
        error: (err) => {
          // Can also log failures if required for compliance
          this.auditService
            .logEvent({
              userId: user?.id || 'anonymous',
              action: `FAILED_${auditData.action || this.mapMethodToAction(method)}`,
              metadata: {
                ipAddress: ip,
                userAgent,
                requestMethod: method,
                requestUrl: url,
                status: err.status || 500,
                errorMessage: err.message,
              },
            })
            .catch((logErr) => {
              this.logger.error(`Failed to log audit event: ${logErr.message}`);
            });
        },
      }),
    );
  }

  private mapMethodToAction(method: string): AuditAction {
    switch (method) {
      case 'POST':
        return AuditAction.CREATE;
      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;
      case 'DELETE':
        return AuditAction.DELETE;
      case 'GET':
        return AuditAction.ACCESS;
      default:
        return AuditAction.ACCESS as any as AuditAction;
    }
  }

  private guessEntityFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[1] || 'Unknown';
  }

  private sanitizeData(data: any): any {
    if (!data) return null;
    const sanitized = { ...data };
    
    // List of sensitive keys to redact from logs
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'private', 'nonce'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
}
