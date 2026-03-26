'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export interface BookmarkButtonProps {
  /** Current bookmarked state */
  isBookmarked?: boolean;
  /** Callback when bookmark state changes */
  onBookmarkChange?: (bookmarked: boolean) => void;
  /** Callback when save action occurs */
  onSave?: () => void | Promise<void>;
  /** Callback when unsave action occurs */
  onUnsave?: () => void | Promise<void>;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Show count badge */
  showCount?: boolean;
  /** Bookmark count */
  count?: number;
  /** Custom bookmarked icon */
  bookmarkedIcon?: React.ReactNode;
  /** Custom unbookmarked icon */
  unbookmarkedIcon?: React.ReactNode;
  /** Custom class names */
  className?: string;
  /** Tooltip text when bookmarked */
  bookmarkedTooltip?: string;
  /** Tooltip text when not bookmarked */
  unbookmarkedTooltip?: string;
  /** Auto-save to localStorage */
  persistent?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

const BookmarkButton = React.forwardRef<HTMLButtonElement, BookmarkButtonProps>(
  (
    {
      isBookmarked: externalBookmarked,
      onBookmarkChange,
      onSave,
      onUnsave,
      loading = false,
      disabled = false,
      size = 'md',
      variant = 'secondary',
      showCount = false,
      count = 0,
      bookmarkedIcon,
      unbookmarkedIcon,
      className = '',
      bookmarkedTooltip = 'Bookmarked',
      unbookmarkedTooltip = 'Bookmark',
      persistent = false,
      storageKey,
      ...props
    },
    ref
  ) => {
    const [internalBookmarked, setInternalBookmarked] = useState(externalBookmarked ?? false);
    const [isLoading, setIsLoading] = useState(false);

    // Sync with external prop
    useEffect(() => {
      if (externalBookmarked !== undefined) {
        setInternalBookmarked(externalBookmarked);
      }
    }, [externalBookmarked]);

    // Load from localStorage on mount if persistent
    useEffect(() => {
      if (persistent && storageKey) {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored !== null) {
            const isBookmarked = JSON.parse(stored);
            setInternalBookmarked(isBookmarked);
            onBookmarkChange?.(isBookmarked);
          }
        } catch (error) {
          console.warn('Failed to load bookmark state from localStorage:', error);
        }
      }
    }, [persistent, storageKey, onBookmarkChange]);

    // Save to localStorage when state changes
    const saveToStorage = useCallback((bookmarked: boolean) => {
      if (persistent && storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(bookmarked));
        } catch (error) {
          console.warn('Failed to save bookmark state to localStorage:', error);
        }
      }
    }, [persistent, storageKey]);

    const handleBookmarkToggle = useCallback(async () => {
      if (loading || disabled || isLoading) {
        return;
      }

      setIsLoading(true);
      const newBookmarkedState = !internalBookmarked;

      try {
        if (newBookmarkedState) {
          // Save action
          await onSave?.();
          onBookmarkChange?.(true);
        } else {
          // Unsave action
          await onUnsave?.();
          onBookmarkChange?.(false);
        }

        setInternalBookmarked(newBookmarkedState);
        saveToStorage(newBookmarkedState);
      } catch (error) {
        console.error('Bookmark action failed:', error);
        // Revert state on error
        setInternalBookmarked(internalBookmarked);
      } finally {
        setIsLoading(false);
      }
    }, [internalBookmarked, loading, disabled, isLoading, onSave, onUnsave, onBookmarkChange, saveToStorage]);

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-2.5 text-lg',
    };

    const variantClasses = {
      primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]',
      secondary: 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-hover)] focus:ring-[var(--color-primary)]',
      ghost: 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus:ring-[var(--color-primary)]',
    };

    const baseClasses = `
      relative inline-flex items-center justify-center gap-2
      rounded-lg font-medium transition-all duration-200 ease-out
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      motion-reduce:transition-none
    `;

    const stateClasses = internalBookmarked
      ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
      : 'text-[var(--text-secondary)] border-[var(--border-default)]';

    const buttonClasses = `
      ${baseClasses}
      ${sizeClasses[size]}
      ${variantClasses[variant]}
      ${stateClasses}
      ${className}
    `.trim().replace(/\s+/g, ' ');

    const defaultBookmarkedIcon = bookmarkedIcon || (
      <BookmarkCheck 
        size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20}
        className="text-current"
      />
    );

    const defaultUnbookmarkedIcon = unbookmarkedIcon || (
      <Bookmark 
        size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20}
        className="text-current"
      />
    );

    const currentIcon = internalBookmarked ? defaultBookmarkedIcon : defaultUnbookmarkedIcon;
    const currentTooltip = internalBookmarked ? bookmarkedTooltip : unbookmarkedTooltip;

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleBookmarkToggle}
        disabled={disabled || loading || isLoading}
        className={buttonClasses}
        title={currentTooltip}
        aria-label={currentTooltip}
        aria-pressed={internalBookmarked}
        {...props}
      >
        {/* Icon */}
        <span className="flex-shrink-0">
          {currentIcon}
        </span>

        {/* Loading Spinner */}
        {(loading || isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)] bg-opacity-80 rounded-lg">
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
          </div>
        )}

        {/* Count Badge */}
        {showCount && count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-[var(--color-error)] text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
            {count > 99 ? '99+' : count.toString()}
          </span>
        )}

        {/* Visually Hidden Status for Screen Readers */}
        <span className="sr-only">
          {internalBookmarked ? 'Bookmarked' : 'Not bookmarked'}
        </span>
      </button>
    );
  }
);

BookmarkButton.displayName = 'BookmarkButton';

export { BookmarkButton };
export type { BookmarkButtonProps };
