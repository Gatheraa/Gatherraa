'use client';

import React from 'react';

type TextVariant = 'body' | 'caption' | 'label' | 'heading-sm' | 'heading-md' | 'heading-lg';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse';

export interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  as?: 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3';
  children: React.ReactNode;
  className?: string;
  id?: string;
  htmlFor?: string;
}

const variantClasses: Record<TextVariant, string> = {
  body: 'text-base',
  caption: 'text-sm',
  label: 'text-sm font-medium',
  'heading-sm': 'text-lg font-semibold',
  'heading-md': 'text-xl font-semibold',
  'heading-lg': 'text-2xl font-bold',
};

const colorClasses: Record<TextColor, string> = {
  primary: 'text-[var(--text-primary)]',
  secondary: 'text-[var(--text-secondary)]',
  muted: 'text-[var(--text-muted)]',
  inverse: 'text-[var(--text-inverse)]',
};

export function Text({
  variant = 'body',
  color = 'primary',
  as: Component = 'p',
  children,
  className = '',
  id,
  htmlFor,
}: TextProps) {
  const variantClass = variantClasses[variant];
  const colorClass = colorClasses[color];

  return (
    <Component
      id={id}
      className={`${variantClass} ${colorClass} ${className}`}
      htmlFor={htmlFor}
    >
      {children}
    </Component>
  );
}
