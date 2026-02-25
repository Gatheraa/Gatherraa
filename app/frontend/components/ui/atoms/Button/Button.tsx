'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  ripple?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
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
  icon:
    'rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--gray-100)] dark:hover:bg-[var(--gray-700)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-3',
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-12 w-12 p-0',
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
      onClick,
      ripple = true,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const nextRippleId = useRef(0);
    const rippleTimeouts = useRef<number[]>([]);
    const isIconVariant = variant === 'icon';
    const rippleColor =
      variant === 'primary' || variant === 'danger' ? 'rgba(255, 255, 255, 0.42)' : 'rgba(37, 99, 235, 0.24)';

    useEffect(() => {
      return () => {
        for (const timeout of rippleTimeouts.current) {
          window.clearTimeout(timeout);
        }
      };
    }, []);

    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const rippleSize = Math.max(rect.width, rect.height) * 1.3;
      const centerX = event.detail === 0 ? rect.width / 2 : event.clientX - rect.left;
      const centerY = event.detail === 0 ? rect.height / 2 : event.clientY - rect.top;
      const id = nextRippleId.current++;

      setRipples((previous) => [
        ...previous,
        {
          id,
          size: rippleSize,
          x: centerX - rippleSize / 2,
          y: centerY - rippleSize / 2,
        },
      ]);

      const timeout = window.setTimeout(() => {
        setRipples((previous) => previous.filter((rippleItem) => rippleItem.id !== id));
        rippleTimeouts.current = rippleTimeouts.current.filter((value) => value !== timeout);
      }, 520);

      rippleTimeouts.current.push(timeout);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled) {
        createRipple(event);
      }
      onClick?.(event);
    };

    const base =
      'relative isolate inline-flex items-center justify-center overflow-hidden font-semibold rounded-xl transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100';
    const variantClass = variantClasses[variant];
    const sizeClass = isIconVariant ? iconOnlySizeClasses[size] : sizeClasses[size];
    const iconSize = iconSizeClasses[size];
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={`${base} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
        {...props}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden>
          {ripples.map((rippleItem) => (
            <span
              key={rippleItem.id}
              className="animate-button-ripple absolute rounded-full"
              style={{
                left: rippleItem.x,
                top: rippleItem.y,
                width: rippleItem.size,
                height: rippleItem.size,
                backgroundColor: rippleColor,
              }}
            />
          ))}
        </span>
        {leftIcon && (
          <span className={`${iconSize} relative z-10 shrink-0`} aria-hidden>
            {leftIcon}
          </span>
        )}
        {children && <span className="relative z-10">{children}</span>}
        {rightIcon && (
          <span className={`${iconSize} relative z-10 shrink-0`} aria-hidden>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
