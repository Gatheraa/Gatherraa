"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui";
import { Spinner } from "@/components/ui";

export type TransactionStatus = "pending" | "success" | "failed";

export interface TransactionStatusProps {
  txPromise: Promise<{ hash: string; wait?: () => Promise<void> }>;
  explorerUrl?: string;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash?: string) => void;
  className?: string;
  showHash?: boolean;
  labels?: {
    pending?: string;
    success?: string;
    failed?: string;
  };
}

interface TransactionState {
  status: TransactionStatus;
  hash: string | null;
  error: Error | null;
}

export function TransactionStatus({
  txPromise,
  explorerUrl,
  onSuccess,
  onError,
  className = "",
  showHash = true,
  labels = {
    pending: "Pending",
    success: "Success",
    failed: "Failed",
  },
}: TransactionStatusProps) {
  const [state, setState] = useState<TransactionState>({
    status: "pending",
    hash: null,
    error: null,
  });

  const handleTransaction = useCallback(async () => {
    try {
      setState({ status: "pending", hash: null, error: null });

      const tx = await txPromise;
      const txHash = tx.hash;

      setState((prev) => ({ ...prev, hash: txHash }));

      if (tx.wait) {
        await tx.wait();
      }

      setState({ status: "success", hash: txHash, error: null });
      onSuccess?.(txHash);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState((prev) => ({
        status: "failed",
        hash: prev.hash,
        error: err,
      }));
      onError?.(err, state.hash || undefined);
    }
  }, [txPromise, onSuccess, onError, state.hash]);

  useEffect(() => {
    handleTransaction();
  }, [handleTransaction]);

  const getExplorerLink = (hash: string): string | null => {
    if (!explorerUrl) return null;
    const baseUrl = explorerUrl.endsWith("/") ? explorerUrl : `${explorerUrl}/`;
    return `${baseUrl}${hash}`;
  };

  const truncateHash = (hash: string): string => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const renderStatusBadge = () => {
    switch (state.status) {
      case "pending":
        return (
          <Badge variant="warning" aria-label="Transaction pending">
            {labels.pending}
          </Badge>
        );
      case "success":
        return (
          <Badge variant="success" aria-label="Transaction successful">
            {labels.success}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="error" aria-label="Transaction failed">
            {labels.failed}
          </Badge>
        );
    }
  };

  const renderIcon = () => {
    switch (state.status) {
      case "pending":
        return (
          <Spinner size="sm" tone="neutral" label="Processing transaction" />
        );
      case "success":
        return (
          <svg
            className="h-5 w-5 text-[var(--color-success)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case "failed":
        return (
          <svg
            className="h-5 w-5 text-[var(--color-error)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4 ${className}`}
      role="region"
      aria-label="Transaction status"
    >
      <div className="flex items-center gap-3">
        {renderIcon()}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">{renderStatusBadge()}</div>
          {state.error && (
            <p className="text-sm text-[var(--color-error)]">
              {state.error.message}
            </p>
          )}
        </div>
      </div>

      {showHash && state.hash && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Transaction Hash
          </span>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-[var(--gray-100)] px-2 py-1 text-sm font-mono text-[var(--text-secondary)] dark:bg-[var(--gray-800)]">
              {truncateHash(state.hash)}
            </code>
            {explorerUrl && (
              <a
                href={getExplorerLink(state.hash) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                aria-label={`View transaction ${truncateHash(state.hash)} on blockchain explorer`}
              >
                View
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
        </div>
      )}
    </div>
  );
}

export default TransactionStatus;
