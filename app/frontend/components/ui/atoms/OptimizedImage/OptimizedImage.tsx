'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Skeleton } from '../Skeleton';

// ─── Types ────────────────────────────────────────────────────────────

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  /** Image source URL */
  src: string;
  /** Alternative text for accessibility */
  alt: string;
  /** Fallback image URL to show on error */
  fallbackSrc?: string;
  /** Low-quality image placeholder (LQIP) or base64 string */
  placeholder?: string;
  /** Show skeleton while loading */
  showSkeleton?: boolean;
  /** Enable lazy loading with Intersection Observer */
  lazy?: boolean;
  /** Root margin for Intersection Observer */
  rootMargin?: string;
  /** Threshold for Intersection Observer (0-1) */
  threshold?: number;
  /** Custom skeleton component */
  skeletonComponent?: React.ReactNode;
  /** Callback when image loads successfully */
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  /** Callback when image fails to load */
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  /** Aspect ratio to prevent layout shift (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Object fit class */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Enable blur-up effect with placeholder */
  blurUp?: boolean;
}

// ─── Helper Functions ─────────────────────────────────────────────────

const getObjectFitClass = (fit?: string): string => {
  switch (fit) {
    case 'cover':
      return 'object-cover';
    case 'contain':
      return 'object-contain';
    case 'fill':
      return 'object-fill';
    case 'none':
      return 'object-none';
    case 'scale-down':
      return 'object-scale-down';
    default:
      return 'object-cover';
  }
};

const getAspectRatioClass = (aspectRatio?: string): string => {
  if (!aspectRatio) return '';
  
  // Handle common aspect ratios
  switch (aspectRatio) {
    case '16/9':
      return 'aspect-video';
    case '4/3':
      return 'aspect-[4/3]';
    case '1/1':
      return 'aspect-square';
    case '3/2':
      return 'aspect-[3/2]';
    case '2/1':
      return 'aspect-[2/1]';
    default:
      return `aspect-[${aspectRatio}]`;
  }
};

// ─── Main Component ─────────────────────────────────────────────────────

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc,
  placeholder,
  showSkeleton = true,
  lazy = true,
  rootMargin = '50px',
  threshold = 0.1,
  skeletonComponent,
  onLoad,
  onError,
  aspectRatio,
  objectFit = 'cover',
  blurUp = true,
  className = '',
  style,
  ...imgProps
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ─── Intersection Observer for Lazy Loading ───────────────────────────────

  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observerRef.current = observer;

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, isInView, rootMargin, threshold]);

  // ─── Image Loading Logic ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    
    img.onload = (event) => {
      setIsLoading(false);
      setHasError(false);
      setCurrentSrc(src);
      onLoad?.(event as any);
    };

    img.onerror = (event) => {
      setIsLoading(false);
      setHasError(true);
      
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
      
      onError?.(event as any);
    };

    img.src = src;
  }, [src, isInView, onLoad, onError, fallbackSrc]);

  // ─── Component Classes ─────────────────────────────────────────────────

  const containerClasses = [
    'relative overflow-hidden',
    getAspectRatioClass(aspectRatio),
    className,
  ].filter(Boolean).join(' ');

  const imageClasses = [
    'w-full h-full transition-opacity duration-300',
    getObjectFitClass(objectFit),
    blurUp && placeholder && isLoading ? 'blur-sm' : '',
    isLoading ? 'opacity-0' : 'opacity-100',
  ].filter(Boolean).join(' ');

  const placeholderStyle = blurUp && placeholder ? {
    backgroundImage: `url(${placeholder})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(20px)',
    transform: 'scale(1.1)',
  } : {};

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div 
      className={containerClasses}
      style={style}
    >
      {/* Placeholder/Blur-up background */}
      {blurUp && placeholder && (
        <div 
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            ...placeholderStyle,
            opacity: isLoading ? 1 : 0,
          }}
        />
      )}

      {/* Skeleton Loader */}
      {showSkeleton && isLoading && (
        <div className="absolute inset-0 z-10">
          {skeletonComponent || <Skeleton variant="rectangular" className="w-full h-full" />}
        </div>
      )}

      {/* Main Image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={imageClasses}
        loading={lazy ? 'lazy' : 'eager'}
        {...imgProps}
      />

      {/* Error State Overlay */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Failed to load image
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Default Props ───────────────────────────────────────────────────────

OptimizedImage.displayName = 'OptimizedImage';
