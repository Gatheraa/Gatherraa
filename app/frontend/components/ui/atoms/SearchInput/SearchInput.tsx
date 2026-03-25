'use client';

import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Callback fired when debounced value changes */
  onSearch?: (value: string) => void;
  /** Show clear button */
  showClear?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Search icon position */
  iconPosition?: 'left' | 'right';
  /** Custom search icon */
  searchIcon?: React.ReactNode;
  /** Custom clear icon */
  clearIcon?: React.ReactNode;
  /** Container className */
  containerClassName?: string;
  /** Minimum characters to trigger search */
  minChars?: number;
  /** Enable search on enter key */
  searchOnEnter?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      debounceMs = 300,
      onSearch,
      showClear = true,
      loading = false,
      iconPosition = 'left',
      searchIcon,
      clearIcon,
      containerClassName = '',
      className = '',
      minChars = 0,
      searchOnEnter = true,
      value: controlledValue,
      defaultValue = '',
      onChange,
      onKeyDown,
      placeholder = 'Search...',
      ...props
    },
    ref
  ) => {
    const [value, setValue] = useState(controlledValue ?? defaultValue ?? '');
    const [isFocused, setIsFocused] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync with controlled value
    useEffect(() => {
      if (controlledValue !== undefined) {
        setValue(controlledValue);
      }
    }, [controlledValue]);

    // Debounced search handler
    const debouncedSearch = useCallback(
      (searchValue: string) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (searchValue.length >= minChars) {
            onSearch?.(searchValue);
          } else if (searchValue.length === 0) {
            onSearch?.('');
          }
        }, debounceMs);
      },
      [onSearch, debounceMs, minChars]
    );

    // Handle input change
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setValue(newValue);
      
      // Trigger debounced search
      debouncedSearch(newValue);
      
      // Call original onChange if provided
      onChange?.(event);
    };

    // Handle key down
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (searchOnEnter && event.key === 'Enter') {
        // Clear timeout and search immediately
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        onSearch?.(value);
      }
      
      onKeyDown?.(event);
    };

    // Handle focus
    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(event);
    };

    // Handle blur
    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(event);
    };

    // Clear input
    const handleClear = () => {
      setValue('');
      
      // Clear timeout and search with empty string
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      onSearch?.('');
      
      // Focus input after clear
      inputRef.current?.focus();
    };

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const baseInputClasses = `
      w-full px-4 py-2.5 pr-10 text-[var(--text-primary)] bg-[var(--surface)]
      border border-[var(--border-default)] rounded-lg
      transition-all duration-200 ease-out
      placeholder:text-[var(--text-muted)]
      focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
      focus:border-transparent focus:bg-[var(--surface-elevated)]
      disabled:opacity-50 disabled:cursor-not-allowed
      motion-reduce:transition-none
    `;

    const iconLeftClasses = iconPosition === 'left' ? 'pl-10' : '';
    const iconRightClasses = iconPosition === 'right' ? 'pr-10' : '';
    const clearButtonClasses = showClear && value ? 'pr-20' : '';

    const inputClasses = `
      ${baseInputClasses}
      ${iconLeftClasses}
      ${iconRightClasses}
      ${clearButtonClasses}
      ${className}
    `.trim().replace(/\s+/g, ' ');

    const containerClasses = `
      relative w-full
      ${containerClassName}
    `.trim().replace(/\s+/g, ' ');

    const defaultSearchIcon = searchIcon || (
      <Search 
        size={18} 
        className="text-[var(--text-muted)] absolute top-1/2 -translate-y-1/2 transition-colors duration-200"
        style={{
          [iconPosition === 'left' ? 'left' : 'right']: '12px'
        }}
      />
    );

    const defaultClearIcon = clearIcon || (
      <X 
        size={16} 
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200"
      />
    );

    return (
      <div className={containerClasses}>
        {/* Search Icon */}
        {defaultSearchIcon}
        
        {/* Input */}
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={loading}
          className={inputClasses}
          {...props}
        />
        
        {/* Loading Spinner */}
        {loading && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 right-12"
            style={{
              [iconPosition === 'right' ? 'left' : 'right']: '12px'
            }}
          >
            <div className="animate-spin w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
          </div>
        )}
        
        {/* Clear Button */}
        {showClear && value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1/2 -translate-y-1/2 right-3 p-1 rounded-md hover:bg-[var(--surface-hover)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            aria-label="Clear search"
          >
            {defaultClearIcon}
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
export type { SearchInputProps };
