'use client';

import React from 'react';
import { Text } from '@/components/ui/atoms/Text';
import { Input } from '@/components/ui/atoms/Input';

export interface FormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children?: React.ReactNode;
  /** When children is not used, renders an Input with spread inputProps */
  inputProps?: React.ComponentProps<typeof Input>;
}

export function FormField({
  label,
  name,
  required,
  error,
  hint,
  children,
  inputProps,
}: FormFieldProps) {
  const id = `field-${name}`;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1">
      <Text
        as="label"
        variant="label"
        color="primary"
        htmlFor={children ? undefined : id}
        id={`${id}-label`}
        className="block"
      >
        {label}
        {required && (
          <span className="text-[var(--color-error)] ml-0.5" aria-hidden>
            *
          </span>
        )}
      </Text>
      {children ? (
        (() => {
          if (React.isValidElement(children) && typeof children.type !== 'string') {
            const child = children as React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
            return React.cloneElement(child, {
              id: child.props.id ?? id,
              'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
              'aria-invalid': !!error,
            });
          }
          return children;
        })()
      ) : (
        <Input
          id={id}
          name={name}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          error={!!error}
          fullWidth
          {...inputProps}
        />
      )}
      {error && (
        <Text
          as="p"
          variant="caption"
          color="primary"
          id={errorId}
          className="text-[var(--color-error)]"
          role="alert"
        >
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text as="p" variant="caption" color="muted" id={hintId}>
          {hint}
        </Text>
      )}
    </div>
  );
}
