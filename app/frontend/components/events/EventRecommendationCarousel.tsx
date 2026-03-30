'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Star, Users } from 'lucide-react';
import type { Event } from '@/lib/api/events';

function formatDateShort(dateInput: string | Date) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRangeShort(start: string, end?: string | null) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  if (endDate && startDate.toDateString() === endDate.toDateString()) {
    return formatDateShort(start);
  }
  if (endDate) {
    return `${formatDateShort(start)} – ${formatDateShort(endDate)}`;
  }
  return formatDateShort(start);
}

function getEventStatus(startTime: string, endTime?: string | null) {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  if (end && now > end) {
    return { label: 'Ended', color: 'bg-gray-500' };
  }
  if (now >= start && (!end || now <= end)) {
    return { label: 'Live', color: 'bg-green-500' };
  }
  if (start.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return { label: 'Upcoming', color: 'bg-blue-500' };
  }
  return { label: 'Scheduled', color: 'bg-gray-400' };
}

export interface EventRecommendationCarouselProps {
  events: Event[];
  /** Section heading */
  title?: string;
  className?: string;
  /** Shown when `events` is empty */
  emptyMessage?: string;
  /** Auto-advance the horizontal track */
  autoplay?: boolean;
  /** Delay between autoplay steps (ms) */
  autoplayIntervalMs?: number;
  /** Previous / next controls (in addition to swipe / trackpad scroll) */
  showControls?: boolean;
}

function EventCarouselCard({ event }: { event: Event }) {
  const status = getEventStatus(event.startDate, event.endDate);

  return (
    <article
      className="flex w-[min(85vw,280px)] shrink-0 snap-start sm:w-72 md:w-80"
      aria-label={event.title}
    >
      <Link
        href={`/events/${event.id}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
          {event.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN / user URLs
            <img
              src={event.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/10 dark:from-blue-500/10 dark:to-purple-500/5">
              <Calendar className="h-10 w-10 text-gray-400 dark:text-gray-600" aria-hidden />
            </div>
          )}
          <span
            className={`absolute left-2 top-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white ${status.color}`}
          >
            {status.label}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-semibold text-gray-900 dark:text-white">
              {event.title}
            </h3>
            {event.statistics?.avgRating != null && (
              <div className="flex shrink-0 items-center gap-0.5 text-sm text-gray-600 dark:text-gray-400">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
                <span className="font-medium">{event.statistics.avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {event.description && (
            <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
              {event.description}
            </p>
          )}

          <div className="mt-auto space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{formatDateRangeShort(event.startDate, event.endDate)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            {event.registeredCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{event.registeredCount} registered</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function EventRecommendationCarousel({
  events,
  title = 'You might also like',
  className = '',
  emptyMessage = 'No recommendations yet.',
  autoplay = false,
  autoplayIntervalMs = 4500,
  showControls = true,
}: EventRecommendationCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pauseHoverRef = useRef(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [events.length, updateArrows]);

  const scrollByPage = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(240, el.clientWidth * 0.75) * dir;
    el.scrollBy({
      left: delta,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [reduceMotion]);

  useEffect(() => {
    if (!autoplay || events.length < 2 || reduceMotion) return;

    const el = scrollerRef.current;
    if (!el) return;

    const tick = () => {
      if (pauseHoverRef.current || document.hidden) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      const atEnd = scrollLeft >= maxScroll - 8;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      } else {
        scrollByPage(1);
      }
    };

    const id = window.setInterval(tick, autoplayIntervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, autoplayIntervalMs, events.length, reduceMotion, scrollByPage]);

  if (events.length === 0) {
    return (
      <section
        className={className}
        aria-label={title}
      >
        {title && (
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section
      className={className}
      aria-roledescription="carousel"
      aria-label={title}
      onMouseEnter={() => {
        pauseHoverRef.current = true;
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          pauseHoverRef.current = false;
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {showControls && events.length > 1 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              aria-label="Scroll recommendations left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              aria-label="Scroll recommendations right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900 sm:w-12"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-gray-50 to-transparent dark:from-gray-900 sm:w-12"
          aria-hidden
        />

        <div
          ref={scrollerRef}
          tabIndex={0}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 [&::-webkit-scrollbar]:hidden"
          style={{ scrollBehavior: reduceMotion ? 'auto' : undefined }}
        >
          {events.map((event) => (
            <EventCarouselCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}
