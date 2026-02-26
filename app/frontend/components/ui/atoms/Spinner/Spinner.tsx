'use client';

import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
type SpinnerTone = 'primary' | 'neutral' | 'inverse';
type SpinnerThickness = 'thin' | 'regular' | 'thick';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  thickness?: SpinnerThickness;
  speedMs?: number;
  label?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
};

const toneClasses: Record<SpinnerTone, string> = {
  primary: 'border-[var(--color-primary-muted)] border-t-[var(--color-primary)]',
  neutral: 'border-[var(--border-default)] border-t-[var(--text-secondary)]',
  inverse: 'border-white/35 border-t-white',
};

const thicknessClasses: Record<SpinnerThickness, string> = {
  thin: 'border-2',
  regular: 'border-[3px]',
  thick: 'border-4',
};

export function Spinner({
  size = 'md',
  tone = 'primary',
  thickness = 'regular',
  speedMs = 800,
  label,
  className = '',
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
      className={`inline-flex items-center gap-2 ${className}`.trim()}
      {...props}
    >
      <span
        aria-hidden
        className={`${sizeClasses[size]} ${toneClasses[tone]} ${thicknessClasses[thickness]} animate-spin rounded-full border-solid`}
        style={{ animationDuration: `${speedMs}ms` }}
      />
      {label && <span className="text-sm text-[var(--text-secondary)]">{label}</span>}
    </div>
  );
}
