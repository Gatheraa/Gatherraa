'use client';

import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, fullWidth, className = '', ...props }, ref) => {
    const base =
      'px-4 py-2 text-[var(--text-primary)] bg-[var(--surface)] border rounded-lg transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
    const borderClass = error
      ? 'border-[var(--color-error)]'
      : 'border-[var(--border-default)] dark:border-[var(--gray-600)] hover:border-[var(--gray-400)] focus:border-[var(--color-primary)]';
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <input
        ref={ref}
        className={`${base} ${borderClass} ${widthClass} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
