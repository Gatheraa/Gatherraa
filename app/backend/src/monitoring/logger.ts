// src/monitoring/logger.ts

type LogLevel = 'error' | 'warn' | 'info';

interface LogPayload {
  level: LogLevel;
  message: string;
  stack?: string;
  metadata?: any;
  url: string;
  userAgent: string;
  timestamp: string;
}

const BACKEND_LOG_ENDPOINT = '/api/logs';

class Logger {
  private async sendToBackend(payload: LogPayload) {
    try {
      await fetch(BACKEND_LOG_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to send log to backend', err);
    }
  }

  private buildPayload(
    level: LogLevel,
    message: string,
    stack?: string,
    metadata?: any,
  ): LogPayload {
    return {
      level,
      message,
      stack,
      metadata,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }

  error(message: string, error?: any, metadata?: any) {
    const payload = this.buildPayload('error', message, error?.stack, metadata);

    console.error(message, error);
    this.sendToBackend(payload);
  }

  warn(message: string, metadata?: any) {
    const payload = this.buildPayload('warn', message, undefined, metadata);
    console.warn(message);
    this.sendToBackend(payload);
  }

  info(message: string, metadata?: any) {
    const payload = this.buildPayload('info', message, undefined, metadata);
    console.info(message);
    this.sendToBackend(payload);
  }
}

export const logger = new Logger();
