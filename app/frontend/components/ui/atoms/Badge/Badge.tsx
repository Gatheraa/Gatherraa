'use client';

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  /** Accessible label when content is not descriptive (e.g. status only) */
  'aria-label'?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--gray-100)] dark:bg-[var(--gray-800)] text-[var(--text-secondary)]',
  success:
    'bg-[var(--color-success-muted)] text-[var(--color-success-muted-foreground)] dark:bg-[var(--color-success-muted)] dark:text-[var(--color-success-muted-foreground)]',
  warning:
    'bg-[var(--color-warning-muted)] text-[var(--color-warning-muted-foreground)] dark:bg-[var(--color-warning-muted)] dark:text-[var(--color-warning-muted-foreground)]',
  error:
    'bg-[var(--color-error-muted)] text-[var(--color-error-muted-foreground)] dark:bg-[var(--color-error-muted)] dark:text-[var(--color-error-muted-foreground)]',
  info:
    'bg-[var(--color-info-muted)] text-[var(--color-info-muted-foreground)] dark:bg-[var(--color-info-muted)] dark:text-[var(--color-info-muted-foreground)]',
};

export function Badge({
  variant = 'default',
  children,
  className = '',
  'aria-label': ariaLabel,
}: BadgeProps) {
  const base =
    'inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full';
  const variantClass = variantClasses[variant];

  return (
    <span
      className={`${base} ${variantClass} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}
