import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import pino from 'pino';

const logger = pino();

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    const userId = request.user?.id;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        logger.info({
          method,
          path: url,
          status: response.statusCode,
          duration_ms: Date.now() - now,
          user_id: userId,
          request_id: requestId,
        });
      }),
    );
  }
}
