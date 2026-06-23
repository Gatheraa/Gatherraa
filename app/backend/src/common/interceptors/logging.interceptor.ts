import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${request.method} ${request.url} ${response.statusCode} ${Date.now() - startedAt}ms requestId=${request.requestId ?? 'unknown'}`,
        );
      }),
      catchError((error) => {
        const status = typeof error?.getStatus === 'function' ? error.getStatus() : 500;
        this.logger.warn(
          `${request.method} ${request.url} ${status} ${Date.now() - startedAt}ms requestId=${request.requestId ?? 'unknown'}`,
        );
        return throwError(() => error);
      }),
    );
  }
}
