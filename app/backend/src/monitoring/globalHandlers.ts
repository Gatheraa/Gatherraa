import { logger } from './logger';

export function setupGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logger.error('Global JS Error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', event.reason);
  });
}
