'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, ShieldAlert, Wallet } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';
import { ConnectWalletModal } from '@/components/wallet/ConnectWalletModal';

export type EventAccessLevel = 'public' | 'registered' | 'organizer';
export type EventRole = 'guest' | 'attendee' | 'organizer';

export interface EventViewerStatus {
  isAuthenticated: boolean;
  isRegistered: boolean;
  isOrganizer: boolean;
  role?: EventRole;
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

  /** Loading state while access is being resolved. */
  loading?: boolean;

  /** Redirect destination shown in fallback UI. */
  redirectTo?: string;
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

  if (required.includes('organizer')) return 'Organizer';
  if (required.includes('registered')) return 'Registered attendee';
  return 'Public';
}

export function EventAccessGate({
  requiredAccess,
  viewerStatus,
  children,
  fallback,
  unauthorizedMessage,
  unauthorizedDescription,
  className = '',
  loading = false,
  redirectTo = '/events',
}: EventAccessGateProps) {
  const wallet = useWalletContext();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const allowed = useMemo(
    () => hasEventAccess(requiredAccess, viewerStatus),
    [requiredAccess, viewerStatus]
  );

  const needsWallet = !viewerStatus.isAuthenticated;
  const accessLabel = getDefaultAccessLabel(requiredAccess);

  if (loading || wallet.status === 'connecting') {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 ${className}`.trim()}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Checking event access…</span>
        </div>
      </div>
    );
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <ConnectWalletModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />

      <div
        className={`rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 ${className}`.trim()}
        role="note"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            {needsWallet ? (
              <Wallet className="h-4 w-4" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4" aria-hidden />
            )}
          </span>

          <div className="flex-1">
            <p className="text-sm font-semibold">
              {unauthorizedMessage ||
                (needsWallet
                  ? 'Connect your wallet to access this event content.'
                  : 'Access denied')}
            </p>

            <p className="mt-1 text-xs opacity-90">
              {unauthorizedDescription ||
                (needsWallet
                  ? 'This event section is gated by wallet authentication.'
                  : `Required access level: ${accessLabel}.`)}
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              {needsWallet ? (
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Wallet className="h-4 w-4" aria-hidden />
                  Connect wallet
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 px-3 py-2 text-sm font-medium dark:border-amber-800">
                  <Lock className="h-4 w-4" aria-hidden />
                  Access restricted
                </div>
              )}

              <Link
                href={redirectTo}
                className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/30"
              >
                Back to events
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}