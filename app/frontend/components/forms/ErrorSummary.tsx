'use client';

import { useEffect, useRef } from 'react';
import { FieldErrors } from 'react-hook-form';

interface ErrorSummaryProps {
  errors: FieldErrors;
  fieldLabels?: Record<string, string>;
  title?: string;
}

export default function ErrorSummary({
  errors,
  fieldLabels = {},
  title = 'Please fix the following errors',
}: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);

  const flatErrors = Object.entries(errors).flatMap(([key, val]) => {
    if (!val) return [];
    if (typeof val === 'object' && 'message' in val && val.message) {
      return [{ field: key, message: val.message as string }];
    }
    // nested object errors
    if (typeof val === 'object') {
      return Object.entries(val as Record<string, any>)
        .filter(([, v]) => v?.message)
        .map(([subKey, v]) => ({
          field: `${key}.${subKey}`,
          message: v.message as string,
        }));
    }
    return [];
  });

  useEffect(() => {
    if (flatErrors.length > 0) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      ref.current?.focus();
    }
  }, [flatErrors.length]);

  if (flatErrors.length === 0) return null;

  const scrollToField = (field: string) => {
    const el = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement)?.focus();
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="rounded-xl border border-red-500/25 bg-red-500/8 p-4 outline-none animate-[errorIn_0.25s_ease]"
      style={{
        background: 'rgba(239,68,68,0.06)',
        borderColor: 'rgba(239,68,68,0.22)',
        animation: 'errorIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275)',
      }}
    >
      <style>{`
        @keyframes errorIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shakeX {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-4px); }
          40%,80% { transform: translateX(4px); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7.5" stroke="#f87171" strokeWidth="1"/>
            <path d="M8 5v3.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11" r="0.75" fill="#f87171"/>
          </svg>
        </div>
        <div>
          <p
            className="text-sm font-semibold text-red-400 mb-0.5"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {title}
          </p>
          <p
            className="text-xs text-red-400/60"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {flatErrors.length} {flatErrors.length === 1 ? 'issue' : 'issues'} found
          </p>
        </div>
      </div>

      {/* Error List */}
      <ul className="flex flex-col gap-1.5 pl-7">
        {flatErrors.map(({ field, message }) => {
          const displayField = fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\./g, ' › ');
          return (
            <li key={field}>
              <button
                type="button"
                onClick={() => scrollToField(field)}
                className="group flex items-start gap-2 text-left w-full hover:opacity-100 opacity-80 transition-opacity"
              >
                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                <span
                  className="text-xs text-red-300/80 group-hover:text-red-300 transition-colors underline-offset-2 group-hover:underline"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  <span className="font-medium text-red-400/90 capitalize">{displayField}:</span>{' '}
                  {message}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}