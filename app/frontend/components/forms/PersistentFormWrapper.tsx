'use client';

import React, { useEffect, useRef, useCallback } from 'react';

/**
 * Persistence storage type
 */
type StorageType = 'local' | 'session';

/**
 * Props for the PersistentFormWrapper component
 */
interface PersistentFormWrapperProps {
  /** The form elements to wrap */
  children: React.ReactNode;
  /** Unique key for storage */
  persistenceKey: string;
  /** Storage medium (local for persistent across sessions, session for current session) */
  storageType?: StorageType;
  /** Optional form ID to target if multiple forms exist in children */
  formId?: string;
  /** Enable automatic restoration of values on mount */
  autoRestore?: boolean;
  /** Callback triggered when state is restored, useful for react-hook-form reset() */
  onRestore?: (data: Record<string, string | boolean | string[]>) => void;
  /** Debounce time in ms to avoid excessive storage writes */
  debounceTime?: number;
}

/**
 * PersistentFormWrapper
 * 
 * A wrapper component that automatically saves form input state to browser storage
 * and restores it across page refreshes or navigations.
 * 
 * Works with native HTML forms and provides callbacks for React-based form libraries.
 */
export const PersistentFormWrapper: React.FC<PersistentFormWrapperProps> = ({
  children,
  persistenceKey,
  storageType = 'local',
  formId,
  autoRestore = true,
  onRestore,
  debounceTime = 500,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Helper to get storage engine safely (SSR check)
  const getStorage = useCallback((): Storage | null => {
    if (typeof window === 'undefined') return null;
    return storageType === 'local' ? window.localStorage : window.sessionStorage;
  }, [storageType]);

  /**
   * Captures the current state of the form
   */
  const captureFormState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;

    const form = formId 
      ? (container.querySelector(`#${formId}`) as HTMLFormElement) 
      : container.querySelector('form');

    if (!form) return null;

    const formData = new FormData(form);
    const data: Record<string, any> = {};

    formData.forEach((value, key) => {
      // Handle multi-value fields (like checkboxes or multiple selects)
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    });

    // Special handling for checkboxes that are NOT checked (they don't show up in FormData)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb: any) => {
      if (!cb.checked && !data[cb.name]) {
        data[cb.name] = false;
      } else if (cb.checked && !Array.isArray(data[cb.name])) {
        // Ensure singular checkboxes are booleans if they don't have a value set
        if (!cb.getAttribute('value') || cb.getAttribute('value') === 'on') {
            data[cb.name] = true;
        }
      }
    });

    return data;
  }, [formId]);

  /**
   * Restores state to the DOM elements
   */
  const restoreDOMState = useCallback((data: Record<string, any>) => {
    const container = containerRef.current;
    if (!container) return;

    const form = formId 
      ? (container.querySelector(`#${formId}`) as HTMLFormElement) 
      : container.querySelector('form');

    if (!form) return;

    Object.entries(data).forEach(([name, value]) => {
      const elements = form.elements.namedItem(name);
      if (!elements) return;

      if (elements instanceof HTMLInputElement) {
        if (elements.type === 'checkbox') {
          elements.checked = Boolean(value);
        } else if (elements.type === 'radio') {
            if (elements.value === String(value)) elements.checked = true;
        } else {
          elements.value = String(value);
        }
      } else if (elements instanceof RadioNodeList) {
          // Handle radio groups or multiple checkboxes with same name
          const nodeList = elements as unknown as NodeListOf<HTMLInputElement>;
          nodeList.forEach((el) => {
              if (el.type === 'radio') {
                  el.checked = el.value === String(value);
              } else if (el.type === 'checkbox') {
                  if (Array.isArray(value)) {
                      el.checked = value.includes(el.value);
                  } else {
                      el.checked = Boolean(value);
                  }
              }
          });
      } else if (elements instanceof HTMLTextAreaElement || elements instanceof HTMLSelectElement) {
          elements.value = String(value);
      }
    });
  }, [formId]);

  /**
   * Persist current state to storage
   */
  const persistState = useCallback(() => {
    const data = captureFormState();
    if (!data) return;

    const storage = getStorage();
    if (storage) {
      storage.setItem(persistenceKey, JSON.stringify(data));
    }
  }, [captureFormState, getStorage, persistenceKey]);

  // Handle restoration on mount
  useEffect(() => {
    if (!autoRestore) return;

    const storage = getStorage();
    if (!storage) return;

    const saved = storage.getItem(persistenceKey);
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        
        // Use callback if provided
        if (onRestore) {
          onRestore(parsedData);
        } else {
          // Fallback to direct DOM manipulation
          // Wait a tick for children to be fully rendered
          const timer = setTimeout(() => {
            restoreDOMState(parsedData);
          }, 0);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error(`Error restoring form state for key "${persistenceKey}":`, err);
      }
    }
  }, [autoRestore, getStorage, persistenceKey, onRestore, restoreDOMState]);

  // Handle captures on input
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleInput = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      
      debounceTimer.current = setTimeout(() => {
        persistState();
      }, debounceTime);
    };

    container.addEventListener('input', handleInput);
    container.addEventListener('change', handleInput);

    return () => {
      container.removeEventListener('input', handleInput);
      container.removeEventListener('change', handleInput);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [debounceTime, persistState]);

  return (
    <div 
      ref={containerRef} 
      className="persistent-form-wrapper"
      data-persistence-key={persistenceKey}
    >
      {children}
    </div>
  );
};
