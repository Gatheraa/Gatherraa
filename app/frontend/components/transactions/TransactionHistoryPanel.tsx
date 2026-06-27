'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui';
import { Skeleton } from '@/components/ui';
import { useGetMyPayments } from '@/lib/react-query/hooks/payments/useGetMyPayments';
import { useWalletContext } from '@/lib/wallet/WalletContext';
import { SUPPORTED_NETWORKS } from '@/types/wallet';

// ── Types ────────────────────────────────────────────────────────────────────

export type TxType = 'ticket_purchase' | 'transfer' | 'refund';
export type TxStatus = 'SUCCESS' | 'PENDING' | 'FAILED';

/** On-chain transaction passed in from a parent that already holds the hash. */
export interface BlockchainTransaction {
  id: string;
  type: TxType;
  txHash: string;
  status: TxStatus;
  amount: number;
  currency: string;
  eventReference: string;
  timestamp: string;
}

interface NormalisedRow {
  id: string;
  type: TxType;
  /** Paystack reference for off-chain rows; tx hash for on-chain rows. */
  reference: string;
  isOnChain: boolean;
  status: TxStatus;
  amount: number;
  currency: string;
  eventReference: string;
  timestamp: string;
}

// ── Lookup maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TxStatus, string> = {
  SUCCESS: 'Success',
  PENDING: 'Pending',
  FAILED: 'Failed',
};

const STATUS_VARIANT: Record<TxStatus, 'success' | 'warning' | 'error'> = {
  SUCCESS: 'success',
  PENDING: 'warning',
  FAILED: 'error',
};

const TYPE_LABEL: Record<TxType, string> = {
  ticket_purchase: 'Ticket Purchase',
  transfer: 'Transfer',
  refund: 'Refund',
};

const TYPE_ICON: Record<TxType, string> = {
  ticket_purchase: '🎟️',
  transfer: '↗️',
  refund: '↩️',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function explorerTxUrl(txHash: string, chainId: number | null): string | null {
  if (!chainId) return null;
  const net = SUPPORTED_NETWORKS[chainId];
  if (!net?.blockExplorer) return null;
  const base = net.blockExplorer.endsWith('/')
    ? net.blockExplorer
    : `${net.blockExplorer}/`;
  return `${base}tx/${txHash}`;
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TxStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function ReferenceCell({
  reference,
  isOnChain,
  chainId,
}: {
  reference: string;
  isOnChain: boolean;
  chainId: number | null;
}) {
  const url = isOnChain ? explorerTxUrl(reference, chainId) : null;
  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded bg-[var(--gray-100)] dark:bg-[var(--gray-800)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
        {truncateHash(reference)}
      </code>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
          aria-label={`View transaction ${truncateHash(reference)} on block explorer`}
        >
          {/* External-link icon */}
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={36} height={36} />
        <div className="flex flex-col gap-2">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={180} />
          <Skeleton variant="text" width={130} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton variant="text" width={60} />
        <Skeleton variant="text" width={80} />
        <Skeleton variant="text" width={100} />
      </div>
    </div>
  );
}

// ── Filter definitions ────────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: TxStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' },
];

const TYPE_TABS: { label: string; value: TxType | 'all' }[] = [
  { label: 'All types', value: 'all' },
  { label: '🎟️ Ticket purchase', value: 'ticket_purchase' },
  { label: '↗️ Transfer', value: 'transfer' },
  { label: '↩️ Refund', value: 'refund' },
];

// ── FilterTab helper ──────────────────────────────────────────────────────────

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface TransactionHistoryPanelProps {
  /**
   * On-chain transactions to display alongside the API payment history.
   * Each entry must carry an actual blockchain tx hash so the block-explorer
   * link renders correctly.
   */
  blockchainTransactions?: BlockchainTransaction[];
  title?: string;
  className?: string;
}

export function TransactionHistoryPanel({
  blockchainTransactions = [],
  title = 'Transaction History',
  className = '',
}: TransactionHistoryPanelProps) {
  const [statusFilter, setStatusFilter] = useState<TxStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<TxType | 'all'>('all');
  const [page, setPage] = useState(1);

  // Wallet context gives us chainId for building block-explorer URLs.
  // The provider is always present in the root layout, so this is safe.
  const { chainId } = useWalletContext();

  const { data, isLoading, isError, refetch } = useGetMyPayments({
    page,
    limit: 10,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });

  // Normalise API payments (off-chain, Paystack) into NormalisedRow.
  // `reference` is a Paystack reference string, not a tx hash, so
  // isOnChain is false and no block-explorer link is rendered.
  const paymentRows: NormalisedRow[] = (data?.data ?? []).map((p) => ({
    id: p.id,
    type: 'ticket_purchase',
    reference: p.reference,
    isOnChain: false,
    status: p.status,
    amount: p.amount / 100, // kobo → naira
    currency: 'NGN',
    eventReference: p.booking?.workspace?.name ?? '—',
    timestamp: p.createdAt,
  }));

  // Normalise on-chain transactions passed in from the parent.
  const chainRows: NormalisedRow[] = blockchainTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    reference: tx.txHash,
    isOnChain: true,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    eventReference: tx.eventReference,
    timestamp: tx.timestamp,
  }));

  // Merge and apply the type filter client-side (status is applied server-side
  // via the API query, so only type filtering is done here).
  const allRows = [...paymentRows, ...chainRows];
  const visibleRows =
    typeFilter === 'all'
      ? allRows
      : allRows.filter((r) => r.type === typeFilter);

  const meta = data?.meta;
  const canGoPrev = page > 1;
  const canGoNext = meta ? page < meta.totalPages : false;

  return (
    <section
      className={[
        'rounded-2xl border border-[var(--border-default)]',
        'bg-[var(--surface-elevated)]',
        className,
      ].join(' ')}
      aria-label={title}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <button
          onClick={() => refetch()}
          className={[
            'flex items-center gap-1 rounded-md px-2 py-1',
            'text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          ].join(' ')}
          aria-label="Refresh transaction history"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border-muted)] px-5 py-2.5">
        {STATUS_TABS.map((t) => (
          <FilterTab
            key={t.value}
            label={t.label}
            active={statusFilter === t.value}
            onClick={() => {
              setStatusFilter(t.value);
              setPage(1);
            }}
          />
        ))}
        <span className="self-center px-1 text-[var(--border-default)]" aria-hidden>
          ·
        </span>
        {TYPE_TABS.map((t) => (
          <FilterTab
            key={t.value}
            label={t.label}
            active={typeFilter === t.value}
            onClick={() => setTypeFilter(t.value)}
          />
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="divide-y divide-[var(--border-muted)]">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-14 text-sm text-[var(--color-error)]">
            <span>Failed to load transactions.</span>
            <button
              onClick={() => refetch()}
              className="text-[var(--color-primary)] underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-14 text-center text-sm text-[var(--text-muted)]">
            No transactions found.
          </div>
        ) : (
          visibleRows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-hover)]"
            >
              {/* Left — icon + details */}
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--gray-100)] text-lg dark:bg-[var(--gray-800)]"
                  aria-hidden
                >
                  {TYPE_ICON[row.type]}
                </span>

                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* Transaction type */}
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {TYPE_LABEL[row.type]}
                  </p>

                  {/* Event reference */}
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {row.eventReference}
                  </p>

                  {/* Block/tx hash */}
                  <ReferenceCell
                    reference={row.reference}
                    isOnChain={row.isOnChain}
                    chainId={chainId}
                  />
                </div>
              </div>

              {/* Right — status + amount + timestamp */}
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <StatusBadge status={row.status} />

                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {row.currency}{' '}
                  {row.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>

                <time
                  dateTime={row.timestamp}
                  className="text-xs text-[var(--text-muted)]"
                >
                  {formatDate(row.timestamp)}
                </time>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border-muted)] px-5 py-3">
          <p className="text-xs text-[var(--text-muted)]">
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!canGoPrev}
              aria-label="Previous page"
              className={[
                'rounded-md px-3 py-1 text-xs font-medium',
                'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
              ].join(' ')}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!canGoNext}
              aria-label="Next page"
              className={[
                'rounded-md px-3 py-1 text-xs font-medium',
                'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
              ].join(' ')}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default TransactionHistoryPanel;
