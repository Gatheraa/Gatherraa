'use client';

import { Suspense, lazy, ComponentType, ReactNode } from 'react';

interface LazyLoadOptions {
  fallback?: ReactNode;
  ssr?: boolean;
}

// Default loading fallback
const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

// Generic lazy load wrapper
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const { fallback = <DefaultFallback />, ssr = false } = options;
  const LazyComponent = lazy(importFunc);

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Preload function for eager loading on interaction
export function preload<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): () => void {
  let component: { default: T } | null = null;
  
  return () => {
    if (!component) {
      importFunc().then((mod) => {
        component = mod;
      });
    }
  };
}
