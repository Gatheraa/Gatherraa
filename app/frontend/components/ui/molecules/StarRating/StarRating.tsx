'use client';

import React from 'react';
import { Star } from 'lucide-react';

export interface StarRatingProps {
  /** Value 0–5 (can be fractional for display) */
  value: number;
  /** Total number of stars */
  max?: number;
  /** Size: small (icons 4), medium (5), large (8) */
  size?: 'sm' | 'md' | 'lg';
  /** Show as interactive (e.g. for form input) */
  interactive?: boolean;
  /** Callback when star is clicked (interactive only) */
  onChange?: (value: number) => void;
  /** Optional label for accessibility */
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

export function StarRating({
  value,
  max = 5,
  size = 'md',
  interactive = false,
  onChange,
  'aria-label': ariaLabel,
}: StarRatingProps) {
  const iconClass = sizeClasses[size];
  const filledColor = 'fill-[#facc15] text-[#facc15]'; // amber-400
  const emptyColor =
    'fill-[var(--gray-300)] text-[var(--gray-300)] dark:fill-[var(--gray-600)] dark:text-[var(--gray-600)]';

  const content = (
    <span
      className="inline-flex items-center gap-0.5"
      role={interactive ? 'group' : 'img'}
      aria-label={ariaLabel ?? (interactive ? undefined : `Rating: ${value} out of ${max} stars`)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFilled = value >= starValue;
        if (interactive && onChange) {
          return (
            <button
              key={starValue}
              type="button"
              onClick={() => onChange(starValue)}
              className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 rounded p-0.5 ${iconClass}`}
              aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
            >
              <Star
                className={`${iconClass} transition-colors ${isFilled ? filledColor : emptyColor}`}
              />
            </button>
          );
        }
        return (
          <Star
            key={starValue}
            className={`${iconClass} ${isFilled ? filledColor : emptyColor}`}
            aria-hidden
          />
        );
      })}
    </span>
  );

  return content;
}
