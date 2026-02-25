'use client';

import React from 'react';
import { Text } from '@/components/ui/atoms/Text';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Optional card title (accessible heading) */
  title?: string;
  /** Optional title element level for semantics */
  titleAs?: 'h2' | 'h3' | 'h4';
}

export function Card({ children, className = '', title, titleAs = 'h3' }: CardProps) {
  const base =
    'bg-[var(--surface)] rounded-lg shadow-[var(--shadow-sm)] border border-[var(--border-default)] overflow-hidden';
  return (
    <section className={`${base} ${className}`} aria-labelledby={title ? 'card-title' : undefined}>
      {title && (
        <Text as={titleAs} variant="heading-sm" id="card-title" className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          {title}
        </Text>
      )}
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`px-4 sm:px-6 pb-4 sm:pb-6 ${className}`}>{children}</div>;
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div
      className={`px-4 sm:px-6 py-4 border-t border-[var(--border-default)] ${className}`}
    >
      {children}
    </div>
  );
}
