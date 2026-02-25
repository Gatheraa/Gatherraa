import { useEffect } from 'react';
import { logger } from './logger';

export function useRenderTracker(componentName: string) {
  useEffect(() => {
    const start = performance.now();

    return () => {
      const end = performance.now();
      const duration = end - start;

      if (duration > 100) {
        logger.warn('Slow Render Detected', {
          component: componentName,
          duration,
        });
      }
    };
  }, [componentName]);
}
