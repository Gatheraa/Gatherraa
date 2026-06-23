import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const message = this.resolveMessage(exceptionResponse, exception);
    const error = this.resolveError(exceptionResponse, status);
    const requestId =
      request.requestId ?? response.getHeader('X-Request-Id')?.toString() ?? undefined;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} failed with ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveMessage(responseBody: unknown, exception: unknown): string | string[] {
    if (typeof responseBody === 'string') {
      return responseBody;
    }

    if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
      const message = (responseBody as { message?: string | string[] }).message;
      if (message) {
        return message;
      }
    }

    if (exception instanceof Error && exception.message) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private resolveError(responseBody: unknown, status: number): string {
    if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
      const error = (responseBody as { error?: string }).error;
      if (error) {
        return error;
      }
    }

    return status >= 500 ? 'Internal Server Error' : 'Request Failed';
  }
}
