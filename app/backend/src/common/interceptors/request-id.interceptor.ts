import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const incomingId = request.headers['x-request-id'];
    const requestId = Array.isArray(incomingId) ? incomingId[0] : incomingId || randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}
