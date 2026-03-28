'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ScrollHeaderContext = createContext(false);

/** Whether the header is in compact (scrolled) mode — for custom inner layouts. */
export function useScrollHeaderCompact(): boolean {
  return useContext(ScrollHeaderContext);
}

export interface ScrollHeaderProps {
  /**
   * Header content. Pass a function to receive `compact` and adapt layout
   * (e.g. show title only when scrolled).
   */
  children: React.ReactNode | ((state: { compact: boolean }) => React.ReactNode);
  className?: string;
  /** Scroll position (px) past which compact styles apply */
  threshold?: number;
  /** Optional element to read scrollTop from instead of `window` */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function ScrollHeader({
  children,
  className = '',
  threshold = 16,
  scrollContainerRef,
}: ScrollHeaderProps) {
  const [compact, setCompact] = useState(false);
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    let y = 0;
    const el = scrollContainerRef?.current;
    if (el) {
      y = el.scrollTop;
    } else if (typeof window !== 'undefined') {
      y = window.scrollY || document.documentElement.scrollTop;
    }
    setCompact((prev) => {
      const next = y > threshold;
      return prev === next ? prev : next;
    });
  }, [threshold, scrollContainerRef]);

  useLayoutEffect(() => {
    const el = scrollContainerRef?.current;
    const target: HTMLElement | Window = el ?? window;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        update();
      });
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      target.removeEventListener('scroll', onScroll);
    };
  }, [update, scrollContainerRef]);

  const resolved = useMemo(
    () => (typeof children === 'function' ? children({ compact }) : children),
    [children, compact]
  );

  const shell = [
    'sticky top-0 z-40 w-full border-b',
    'pt-[max(0.5rem,env(safe-area-inset-top))]',
    'transition-[padding-bottom,box-shadow,background-color,border-color] duration-300 ease-out',
    'motion-reduce:transition-none',
    compact
      ? 'border-gray-200/90 bg-white/95 pb-2 shadow-md backdrop-blur-md dark:border-gray-700/90 dark:bg-gray-900/95 max-[380px]:pb-1.5'
      : 'border-transparent bg-gray-50 pb-3.5 shadow-none dark:bg-gray-900 max-[380px]:pb-2.5',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ScrollHeaderContext.Provider value={compact}>
      <header className={shell}>{resolved}</header>
    </ScrollHeaderContext.Provider>
  );
}
