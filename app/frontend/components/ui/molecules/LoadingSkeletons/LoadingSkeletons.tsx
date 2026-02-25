'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/atoms/Skeleton';

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function SkeletonCard({ lines = 3, className = '', ...props }: SkeletonCardProps) {
  const safeLines = Math.max(1, lines);

  return (
    <div
      className={`space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] p-4 ${className}`.trim()}
      {...props}
    >
      <Skeleton variant="rounded" height={160} />
      <div className="space-y-2">
        <Skeleton variant="text" width="58%" />
        {Array.from({ length: safeLines }).map((_, index) => (
          <Skeleton key={`card-line-${index}`} variant="text" width={index === safeLines - 1 ? '42%' : '100%'} />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
  ...props
}: SkeletonTableProps) {
  const safeRows = Math.max(1, rows);
  const safeColumns = Math.max(2, columns);
  const tableGridStyle = { gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))` };

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface)] ${className}`.trim()}
      {...props}
    >
      {showHeader && (
        <div className="grid gap-3 border-b border-[var(--border-default)] bg-[var(--surface-elevated)] p-4" style={tableGridStyle}>
          {Array.from({ length: safeColumns }).map((_, index) => (
            <Skeleton key={`header-col-${index}`} variant="text" width="70%" />
          ))}
        </div>
      )}
      <div className="space-y-3 p-4">
        {Array.from({ length: safeRows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="grid gap-3" style={tableGridStyle}>
            {Array.from({ length: safeColumns }).map((_, columnIndex) => (
              <Skeleton
                key={`row-${rowIndex}-col-${columnIndex}`}
                variant="text"
                width={columnIndex === 0 ? '82%' : '64%'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SkeletonPageProps extends React.HTMLAttributes<HTMLDivElement> {
  cards?: number;
}

export function SkeletonPage({ cards = 3, className = '', ...props }: SkeletonPageProps) {
  const safeCards = Math.max(1, cards);

  return (
    <section className={`space-y-6 ${className}`.trim()} {...props}>
      <div className="space-y-2">
        <Skeleton variant="text" width="28%" height={30} />
        <Skeleton variant="text" width="52%" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: safeCards }).map((_, index) => (
          <SkeletonCard key={`page-card-${index}`} lines={2} />
        ))}
      </div>
    </section>
  );
}
