'use client';

import React from 'react';
import { Lock } from 'lucide-react';

export type EventAccessLevel = 'public' | 'registered' | 'organizer';

export interface EventViewerStatus {
  isAuthenticated: boolean;
  isRegistered: boolean;
  isOrganizer: boolean;
}

export interface EventAccessGateProps {
  /** Required access level(s) for this UI section. */
  requiredAccess: EventAccessLevel | EventAccessLevel[];
  /** Current viewer status for this event. */
  viewerStatus: EventViewerStatus;
  /** Content to render when access is granted. */
  children: React.ReactNode;
  /** Optional custom fallback when unauthorized. */
  fallback?: React.ReactNode;
  /** Optional message for default fallback. */
  unauthorizedMessage?: string;
  /** Optional description for default fallback. */
  unauthorizedDescription?: string;
  /** Optional className for wrapper. */
  className?: string;
}

export function hasEventAccess(
  requiredAccess: EventAccessLevel | EventAccessLevel[],
  viewerStatus: EventViewerStatus
): boolean {
  const required = Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess];

  return required.some((level) => {
    switch (level) {
      case 'public':
        return true;
      case 'registered':
        return viewerStatus.isRegistered || viewerStatus.isOrganizer;
      case 'organizer':
        return viewerStatus.isOrganizer;
      default:
        return false;
    }
  });
}

function getDefaultAccessLabel(requiredAccess: EventAccessLevel | EventAccessLevel[]): string {
  const required = Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess];

  if (required.includes('public')) return 'Public';
  if (required.includes('organizer')) return 'Organizer';
  if (required.includes('registered')) return 'Registered attendee';
  return 'Restricted';
}

export function EventAccessGate({
  requiredAccess,
  viewerStatus,
  children,
  fallback,
  unauthorizedMessage,
  unauthorizedDescription,
  className = '',
}: EventAccessGateProps) {
  const allowed = hasEventAccess(requiredAccess, viewerStatus);

  if (allowed) {
    return <div className={className}>{children}</div>;
  }

  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  const accessLabel = getDefaultAccessLabel(requiredAccess);

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 ${className}`.trim()}
      role="note"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">
            {unauthorizedMessage || 'You do not currently have access to this section.'}
          </p>
          <p className="mt-1 text-xs opacity-90">
            {unauthorizedDescription || `Required access level: ${accessLabel}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
