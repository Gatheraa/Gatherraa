'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Share2, UserRound } from 'lucide-react';
import type { Event } from '@/lib/api/events';
import { RegisterButton } from '@/components/RegisterButton';
import ShareEvent from '@/components/Shareevent';
import { BookmarkButton } from '@/components/ui';

/** Viewer + registration context — supply from auth / API (e.g. `useAuth` + RSVP state). */
export interface EventActionUserState {
  isAuthenticated: boolean;
  /** User has completed registration for this event */
  isRegistered: boolean;
  /** Event host / organizer — hides public register CTA */
  isOrganizer?: boolean;
}

export interface EventActionPanelProps {
  /** Event fields used for share copy, capacity, and scheduling */
  event: Pick<
    Event,
    | 'id'
    | 'title'
    | 'startDate'
    | 'endDate'
    | 'location'
    | 'capacity'
    | 'registeredCount'
  >;
  user: EventActionUserState;
  /** Page URL to share (defaults to `window.location.href` on client) */
  shareUrl?: string;
  /** e.g. wallet or login route — shown when guest; omit for text-only CTA */
  signInHref?: string;
  signInLabel?: string;
  /** Passed through to `RegisterButton` when registration is available */
  onRegisterSuccess?: (signature: string) => void;
  onRegisterError?: (error: Error) => void;
  /** Controlled bookmark; omit to use local persistence only */
  isBookmarked?: boolean;
  onBookmarkChange?: (bookmarked: boolean) => void;
  /** Persist bookmark in `localStorage` for this event id */
  bookmarkPersistent?: boolean;
  /** When true, treat event as no longer accepting registration regardless of dates */
  registrationClosed?: boolean;
  className?: string;
}

function formatShareDate(startDate: string, endDate?: string | null) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const datePart = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  const timePart = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (end && start.toDateString() === end.toDateString()) {
    return `${datePart(start)} · ${timePart(start)} – ${timePart(end)}`;
  }
  if (end) {
    return `${datePart(start)} ${timePart(start)} – ${datePart(end)} ${timePart(end)}`;
  }
  return `${datePart(start)} · ${timePart(start)}`;
}

function isEventEnded(event: Pick<Event, 'startDate' | 'endDate'>) {
  const now = Date.now();
  if (event.endDate) {
    return now > new Date(event.endDate).getTime();
  }
  return now > new Date(event.startDate).getTime();
}

function isEventFull(event: Pick<Event, 'capacity' | 'registeredCount'>) {
  return event.capacity > 0 && event.registeredCount >= event.capacity;
}

type RegistrationVariant =
  | 'organizer'
  | 'registered'
  | 'ended'
  | 'full'
  | 'closed'
  | 'guest'
  | 'register';

function getRegistrationVariant(
  user: EventActionUserState,
  event: Pick<Event, 'startDate' | 'endDate' | 'capacity' | 'registeredCount'>,
  registrationClosed: boolean
): RegistrationVariant {
  if (user.isOrganizer) return 'organizer';
  if (user.isRegistered) return 'registered';
  if (registrationClosed) return 'closed';
  if (isEventEnded(event)) return 'ended';
  if (isEventFull(event)) return 'full';
  if (!user.isAuthenticated) return 'guest';
  return 'register';
}

export function EventActionPanel({
  event,
  user,
  shareUrl,
  signInHref,
  signInLabel = 'Sign in to register',
  onRegisterSuccess,
  onRegisterError,
  isBookmarked,
  onBookmarkChange,
  bookmarkPersistent = true,
  registrationClosed = false,
  className = '',
}: EventActionPanelProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setClientUrl(typeof window !== 'undefined' ? window.location.href : undefined);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shareOpen]);

  const resolvedShareUrl = shareUrl ?? clientUrl ?? '';

  const shareDateLabel = useMemo(
    () => formatShareDate(event.startDate, event.endDate),
    [event.startDate, event.endDate]
  );

  const variant = useMemo(
    () => getRegistrationVariant(user, event, registrationClosed),
    [user, event, registrationClosed]
  );

  const closeShare = useCallback(() => setShareOpen(false), []);

  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
      aria-label="Event actions"
    >
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700 sm:px-5">
        <h2 className="text-sm font-semibold tracking-wide text-gray-900 dark:text-white">
          Actions
        </h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Register, share, or save this event
        </p>
      </div>

      <div className="space-y-0">
        {/* Registration */}
        <div className="px-4 py-4 sm:px-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Registration
          </p>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            {variant === 'organizer' && (
              <div className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">You are hosting</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Manage this event from your organizer tools.
                  </p>
                </div>
              </div>
            )}

            {variant === 'registered' && (
              <div className="flex gap-3 text-sm text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">You&apos;re registered</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    We&apos;ll see you there. Share the event with friends below.
                  </p>
                </div>
              </div>
            )}

            {variant === 'ended' && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This event has ended — registration is closed.
              </p>
            )}

            {variant === 'full' && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This event is at capacity.
              </p>
            )}

            {variant === 'closed' && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Registration is closed for this event.
              </p>
            )}

            {variant === 'guest' && (
              <div className="space-y-3 text-center sm:text-left">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect or sign in to register for this event.
                </p>
                {signInHref ? (
                  <Link
                    href={signInHref}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:w-auto"
                  >
                    {signInLabel}
                  </Link>
                ) : null}
              </div>
            )}

            {variant === 'register' && (
              <RegisterButton
                onSuccess={onRegisterSuccess}
                onError={onRegisterError}
                label="Register for event"
              />
            )}
          </div>
        </div>

        {/* Share & bookmark */}
        <div className="border-t border-gray-100 px-4 py-4 dark:border-gray-700 sm:px-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Share &amp; save
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <Share2 className="h-4 w-4 shrink-0" aria-hidden />
              Share
            </button>
            <BookmarkButton
              isBookmarked={isBookmarked}
              onBookmarkChange={onBookmarkChange}
              persistent={bookmarkPersistent}
              storageKey={
                bookmarkPersistent ? `gatherraa-event-bookmark-${event.id}` : undefined
              }
              variant="secondary"
              size="md"
              className="flex-1 border-gray-300 dark:border-gray-600 sm:min-w-[140px]"
              bookmarkedTooltip="Saved"
              unbookmarkedTooltip="Bookmark"
            />
          </div>
        </div>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share event"
          onClick={closeShare}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareEvent
              eventTitle={event.title}
              eventDate={shareDateLabel}
              eventLocation={event.location}
              eventUrl={resolvedShareUrl}
              onClose={closeShare}
            />
          </div>
        </div>
      )}
    </section>
  );
}
