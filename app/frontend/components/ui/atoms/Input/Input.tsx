'use client';

import React, { forwardRef, useEffect, useId, useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
  label?: string;
  containerClassName?: string;
}

const hasValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && String(value).length > 0;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      error,
      fullWidth,
      label,
      containerClassName = '',
      className = '',
      id,
      required,
      onFocus,
      onBlur,
      onChange,
      value,
      defaultValue,
      placeholder,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = useId().replace(/:/g, '');
    const inputId = id ?? `input-${generatedId}`;
    const [isFocused, setIsFocused] = useState(false);
    const [isFilled, setIsFilled] = useState(() => hasValue(value ?? defaultValue));

    useEffect(() => {
      if (value !== undefined) {
        setIsFilled(hasValue(value));
      }
    }, [value]);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setIsFilled(hasValue(event.currentTarget.value));
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setIsFilled(hasValue(event.currentTarget.value));
      }
      onChange?.(event);
    };

    const base =
      'peer px-4 text-[var(--text-primary)] bg-[var(--surface)] border rounded-lg transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:border-transparent focus:bg-[var(--surface-elevated)] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none';
    const spacingClass = label ? 'pt-5 pb-2' : 'py-2';
    const placeholderClass = label ? 'placeholder:opacity-0 focus:placeholder:opacity-100' : '';
    const borderClass = error
      ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]'
      : 'border-[var(--border-default)] dark:border-[var(--gray-600)] hover:border-[var(--gray-400)] focus:border-[var(--color-primary)]';
    const widthClass = fullWidth ? 'w-full' : '';
    const stateClass = error ? 'input-error-state' : '';
    const shouldFloatLabel = !!label && (isFocused || isFilled);
    const valueProps = value !== undefined ? { value } : { defaultValue };

    return (
      <div className={`relative ${widthClass} ${stateClass} ${containerClassName}`.trim()}>
        <input
          ref={ref}
          id={inputId}
          required={required}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`${base} ${spacingClass} ${placeholderClass} ${borderClass} ${widthClass} ${className}`.trim()}
          aria-invalid={error ? 'true' : ariaInvalid}
          {...valueProps}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={`pointer-events-none absolute left-3 px-1 transition-all duration-200 ease-out motion-reduce:transition-none ${
              shouldFloatLabel ? 'top-1 translate-y-0 text-xs' : 'top-1/2 -translate-y-1/2 text-sm'
            } ${
              error
                ? 'text-[var(--color-error)]'
                : shouldFloatLabel
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--text-muted)]'
            }`}
            style={{ backgroundColor: 'var(--surface)' }}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-[var(--color-error)]" aria-hidden>
                *
              </span>
            )}
          </label>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
