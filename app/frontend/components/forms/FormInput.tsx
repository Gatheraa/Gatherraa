'use client';

import { forwardRef, useState } from 'react';
import { FieldError } from 'react-hook-form';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  label: string;
  name: string;
  error?: FieldError | { message?: string };
  hint?: string;
  as?: 'input' | 'textarea' | 'select';
  rows?: number;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  children?: React.ReactNode; // for select options
  isValid?: boolean;
}

// ─── FormInput Component ──────────────────────────────────────────────────────
const FormInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  FormInputProps
>(({
  label,
  name,
  error,
  hint,
  as = 'input',
  rows = 4,
  icon,
  rightElement,
  children,
  isValid,
  className = '',
  required,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false);
  const hasError = !!error?.message;

  const baseClass = [
    'w-full bg-[#0f1117] text-sm text-white placeholder-[#4a5568]',
    'border rounded-xl px-4 py-3 outline-none transition-all duration-200',
    'font-["DM_Sans",sans-serif]',
    icon ? 'pl-11' : '',
    rightElement ? 'pr-11' : '',
    hasError
      ? 'border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5'
      : isValid
        ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10'
        : focused
          ? 'border-[#3d5afe]/70 ring-2 ring-[#3d5afe]/20'
          : 'border-[#1e2333] hover:border-[#2a3150]',
    className,
  ].filter(Boolean).join(' ');

  const sharedProps = {
    id: name,
    name,
    ref: ref as any,
    className: baseClass,
    onFocus: () => setFocused(true),
    onBlur: (e: any) => { setFocused(false); props.onBlur?.(e); },
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${name}-error` : hint ? `${name}-hint` : undefined,
    ...props,
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      <label
        htmlFor={name}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#6b7db3]"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {label}
        {required && <span className="text-[#ff4d6d] ml-0.5">*</span>}
        {isValid && !hasError && (
          <span className="ml-auto text-emerald-400 normal-case tracking-normal font-normal">
            <CheckIcon />
          </span>
        )}
      </label>

      {/* Input Wrapper */}
      <div className="relative">
        {icon && (
          <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            hasError ? 'text-red-400' : focused ? 'text-[#3d5afe]' : 'text-[#4a5568]'
          }`}>
            {icon}
          </span>
        )}

        {as === 'textarea' ? (
          <textarea
            {...sharedProps}
            rows={rows}
            className={baseClass + ' resize-none'}
            style={{ paddingTop: '12px', paddingBottom: '12px' }}
          />
        ) : as === 'select' ? (
          <select {...sharedProps} className={baseClass + ' appearance-none cursor-pointer'}>
            {children}
          </select>
        ) : (
          <input {...sharedProps} />
        )}

        {rightElement && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </span>
        )}

        {/* Select arrow */}
        {as === 'select' && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a5568]">
            <ChevronIcon />
          </span>
        )}
      </div>

      {/* Error / Hint */}
      {hasError ? (
        <p
          id={`${name}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-red-400"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <ErrorDotIcon />
          {error!.message}
        </p>
      ) : hint ? (
        <p
          id={`${name}-hint`}
          className="text-xs text-[#4a5568]"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
});

FormInput.displayName = 'FormInput';
export default FormInput;

// ─── Micro Icons ──────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6.5" stroke="#34d399" strokeWidth="1"/>
    <path d="M4.5 7l2 2 3-3" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ErrorDotIcon = () => (
  <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
    <circle cx="3" cy="3" r="3" fill="#f87171"/>
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3.5 5.5L7 9l3.5-3.5" stroke="#4a5568" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);