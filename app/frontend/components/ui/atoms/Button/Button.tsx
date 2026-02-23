'use client';

import React, { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm',
  secondary:
    'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--gray-100)] dark:hover:bg-[var(--gray-700)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--gray-100)] dark:hover:bg-[var(--gray-800)]',
  danger:
    'bg-[var(--color-error)] text-white hover:bg-red-600 dark:hover:bg-red-700',
  outline:
    'border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary-muted)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-3',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClass = variantClasses[variant];
    const sizeClass = sizeClasses[size];
    const iconSize = iconSizeClasses[size];
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={`${base} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
        {...props}
      >
        {leftIcon && (
          <span className={iconSize} aria-hidden>
            {leftIcon}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className={iconSize} aria-hidden>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
