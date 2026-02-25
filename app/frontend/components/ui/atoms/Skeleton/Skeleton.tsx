'use client';

import React from 'react';

type SkeletonVariant = 'text' | 'rectangular' | 'rounded' | 'circular';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  animate?: boolean;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded-md',
  rectangular: 'h-24 rounded-lg',
  rounded: 'h-24 rounded-xl',
  circular: 'h-12 w-12 rounded-full',
};

const toCssSize = (value?: number | string) => {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? `${value}px` : value;
};

export function Skeleton({
  variant = 'text',
  width,
  height,
  animate = true,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden bg-[var(--border-muted)] ${variantClasses[variant]} ${className}`.trim()}
      style={{ width: toCssSize(width), height: toCssSize(height), ...style }}
      {...props}
    >
      {animate && <span className="skeleton-shimmer absolute inset-0" />}
    </div>
  );
}
