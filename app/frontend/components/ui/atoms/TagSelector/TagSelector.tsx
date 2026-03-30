'use client';

import React, { useMemo, useState } from 'react';

type TagSelectorError = { message?: string };

export interface TagSelectorProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  hint?: string;
  error?: TagSelectorError;
}

const DEFAULT_MAX_TAGS = 10;

export function TagSelector({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag and press Enter',
  maxTags = DEFAULT_MAX_TAGS,
  required = false,
  disabled = false,
  id,
  name,
  hint,
  error,
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const inputId = id ?? name ?? 'event-tags';
  const hasError = Boolean(error?.message || inlineError);
  const lowerTags = useMemo(() => value.map((tag) => tag.toLowerCase()), [value]);

  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];

    return suggestions
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => tag.toLowerCase().includes(query))
      .filter((tag) => !lowerTags.includes(tag.toLowerCase()))
      .slice(0, 6);
  }, [inputValue, lowerTags, suggestions]);

  const addTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;

    if (tag.length > 20) {
      setInlineError('Tag must be 20 characters or less');
      return;
    }

    if (value.length >= maxTags) {
      setInlineError(`You can add up to ${maxTags} tags`);
      return;
    }

    if (lowerTags.includes(tag.toLowerCase())) {
      setInlineError('Tag already added');
      return;
    }

    onChange([...value, tag]);
    setInputValue('');
    setInlineError(null);
    setActiveSuggestionIndex(-1);
  };

  const removeTag = (index: number) => {
    const nextTags = value.filter((_, tagIndex) => tagIndex !== index);
    onChange(nextTags);
    setInlineError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % filteredSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        if (prev <= 0) return filteredSuggestions.length - 1;
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Escape') {
      setActiveSuggestionIndex(-1);
      return;
    }

    if (event.key === 'Backspace' && !inputValue.trim() && value.length > 0) {
      event.preventDefault();
      removeTag(value.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();

      if (activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        addTag(filteredSuggestions[activeSuggestionIndex]);
        return;
      }

      addTag(inputValue);
      return;
    }
  };

  const handleSuggestionMouseDown = (suggestion: string) => {
    addTag(suggestion);
  };

  const helperText = error?.message || inlineError || hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#6b7db3]"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {label}
        {required && <span className="text-[#ff4d6d] ml-0.5">*</span>}
        <span className="ml-auto normal-case tracking-normal font-normal text-[#4a5568]">
          {value.length}/{maxTags}
        </span>
      </label>

      <div className="relative">
        <div
          className={[
            'w-full min-h-12 rounded-xl border px-3 py-2 bg-[#0f1117] transition-all duration-200',
            'flex flex-wrap items-center gap-2',
            hasError
              ? 'border-red-500/60 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 bg-red-500/5'
              : focused
                ? 'border-[#3d5afe]/70 ring-2 ring-[#3d5afe]/20'
                : 'border-[#1e2333] hover:border-[#2a3150]',
            disabled ? 'opacity-60 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {value.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#3d5afe]/40 bg-[#3d5afe]/10 px-2.5 py-1 text-xs text-[#d7ddff]"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                aria-label={`Remove tag ${tag}`}
                className="rounded-full p-0.5 text-[#9aa6d8] hover:text-white hover:bg-[#3d5afe]/30 focus:outline-none focus:ring-2 focus:ring-[#3d5afe]/50"
                disabled={disabled}
              >
                <span aria-hidden>×</span>
              </button>
            </span>
          ))}

          <input
            id={inputId}
            name={name}
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setInlineError(null);
              setActiveSuggestionIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setActiveSuggestionIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={value.length >= maxTags ? `Maximum ${maxTags} tags reached` : placeholder}
            disabled={disabled || value.length >= maxTags}
            className="min-w-[140px] flex-1 bg-transparent text-sm text-white placeholder-[#4a5568] outline-none"
            autoComplete="off"
            aria-invalid={hasError}
            aria-describedby={helperText ? `${inputId}-helper` : undefined}
            aria-expanded={filteredSuggestions.length > 0 && focused}
            aria-controls={`${inputId}-suggestions`}
          />
        </div>

        {focused && filteredSuggestions.length > 0 && (
          <ul
            id={`${inputId}-suggestions`}
            role="listbox"
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[#1e2333] bg-[#111521] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseDown={() => handleSuggestionMouseDown(suggestion)}
                  className={[
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    index === activeSuggestionIndex
                      ? 'bg-[#3d5afe]/20 text-white'
                      : 'text-[#cdd5ff] hover:bg-[#1a2033]',
                  ].join(' ')}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {helperText ? (
        <p
          id={`${inputId}-helper`}
          className={[
            'text-xs',
            hasError ? 'text-red-400' : 'text-[#4a5568]',
          ].join(' ')}
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
