'use client';

import React, { useState } from 'react';

export interface AdaptiveThumbnailProps {
  thumbnailUrl?: string;
  altText: string;
  onClick?: () => void;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function AdaptiveThumbnail({
  thumbnailUrl,
  altText,
  onClick,
  className = '',
  imageClassName = '',
  priority = false,
}: AdaptiveThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-muted)] ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Skeleton Loader */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-[var(--border-default)]/30" />
      )}

      {/* Error / Empty State */}
      {(!thumbnailUrl || hasError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--surface-raised)] p-4 text-center text-[var(--text-muted)]">
          <svg
            className="mb-2 h-8 w-8 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs font-medium">No Thumbnail</span>
        </div>
      )}

      {/* Image */}
      {thumbnailUrl && !hasError && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbnailUrl}
          alt={altText}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-all duration-500 ease-out will-change-transform hover:scale-105 group-hover:scale-105 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          } ${imageClassName}`}
        />
      )}
    </div>
  );
}