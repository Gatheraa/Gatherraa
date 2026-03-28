"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui";
import { Spinner } from "@/components/ui";

export type TransactionStatus = "pending" | "confirmed" | "failed";

export interface TransactionStatusTrackerProps {
  txHash: string;
  provider?: any; // ethers Provider or similar
  pollingInterval?: number; // in milliseconds
  timeout?: number; // in milliseconds
  explorerUrl?: string;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash: string) => void;
  onTimeout?: (hash: string) => void;
  className?: string;
  showHash?: boolean;
  showTimestamp?: boolean;
  labels?: {
    pending?: string;
    confirmed?: string;
    failed?: string;
    timeout?: string;
  };
  useWebSocket?: boolean;
  websocketUrl?: string;
}

interface TransactionState {
  status: TransactionStatus;
  hash: string;
  error: Error | null;
  timestamp: Date | null;
  confirmations: number;
  gasUsed?: string;
  blockNumber?: number;
}

interface TransactionReceipt {
  status: number; // 1 = success, 0 = failure
  blockNumber: number;
  gasUsed: string;
  confirmations?: number;
}

export function TransactionStatusTracker({
  txHash,
  provider,
  pollingInterval = 5000, // 5 seconds default
  timeout = 300000, // 5 minutes default
  explorerUrl,
  onSuccess,
  onError,
  onTimeout,
  className = "",
  showHash = true,
  showTimestamp = true,
  labels = {
    pending: "Pending",
    confirmed: "Confirmed",
    failed: "Failed",
    timeout: "Timeout",
  },
  useWebSocket = false,
  websocketUrl,
}: TransactionStatusTrackerProps) {
  const [state, setState] = useState<TransactionState>({
    status: "pending",
    hash: txHash,
    error: null,
    timestamp: new Date(),
    confirmations: 0,
  });

  const [isTracking, setIsTracking] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const getTransactionReceipt = useCallback(async (): Promise<TransactionReceipt | null> => {
    if (!provider) {
      throw new Error("No provider available");
    }

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return {
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          confirmations: receipt.confirmations || 1,
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get transaction receipt: ${error}`);
    }
  }, [provider, txHash]);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.hash === txHash) {
        if (data.status === "confirmed") {
          setState({
            status: "confirmed",
            hash: txHash,
            error: null,
            timestamp: new Date(),
            confirmations: data.confirmations || 1,
            gasUsed: data.gasUsed,
            blockNumber: data.blockNumber,
          });
          setIsTracking(false);
          onSuccess?.(txHash);
        } else if (data.status === "failed") {
          const error = new Error(data.error || "Transaction failed");
          setState({
            status: "failed",
            hash: txHash,
            error,
            timestamp: new Date(),
            confirmations: 0,
          });
          setIsTracking(false);
          onError?.(error, txHash);
        }
      }
    } catch (error) {
      console.error("WebSocket message parsing error:", error);
    }
  }, [txHash, onSuccess, onError]);

  const startWebSocketTracking = useCallback(() => {
    if (!websocketUrl) return;

    try {
      const ws = new WebSocket(websocketUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        // Subscribe to transaction updates
        ws.send(JSON.stringify({
          type: "subscribe",
          hash: txHash,
        }));
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Fallback to polling
        startPolling();
      };

      ws.onclose = () => {
        if (isTracking) {
          // Fallback to polling if WebSocket closes unexpectedly
          startPolling();
        }
      };
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      // Fallback to polling
      startPolling();
    }
  }, [websocketUrl, txHash, isTracking, handleWebSocketMessage]);

  const startPolling = useCallback(() => {
    if (!isTracking) return;

    const poll = async () => {
      try {
        const receipt = await getTransactionReceipt();

        if (receipt) {
          if (receipt.status === 1) {
            // Transaction confirmed
            setState({
              status: "confirmed",
              hash: txHash,
              error: null,
              timestamp: new Date(),
              confirmations: receipt.confirmations || 1,
              gasUsed: receipt.gasUsed,
              blockNumber: receipt.blockNumber,
            });
            setIsTracking(false);
            onSuccess?.(txHash);
          } else {
            // Transaction failed
            const error = new Error("Transaction failed on-chain");
            setState({
              status: "failed",
              hash: txHash,
              error,
              timestamp: new Date(),
              confirmations: 0,
            });
            setIsTracking(false);
            onError?.(error, txHash);
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState(prev => ({
          ...prev,
          error: err,
        }));
      }
    };

    // Initial poll
    poll();

    // Set up recurring polling
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
  }, [isTracking, getTransactionReceipt, txHash, onSuccess, onError, pollingInterval]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  }, []);

  // Handle timeout
  useEffect(() => {
    if (!isTracking) return;

    timeoutRef.current = setTimeout(() => {
      const timeoutError = new Error(`Transaction tracking timed out after ${timeout}ms`);
      setState(prev => ({
        ...prev,
        error: timeoutError,
      }));
      setIsTracking(false);
      onTimeout?.(txHash);
      stopTracking();
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isTracking, timeout, txHash, onTimeout, stopTracking]);

  // Start tracking
  useEffect(() => {
    if (!isTracking) return;

    if (useWebSocket && websocketUrl) {
      startWebSocketTracking();
    } else {
      startPolling();
    }

    return stopTracking;
  }, [isTracking, useWebSocket, websocketUrl, startWebSocketTracking, startPolling, stopTracking]);

  const getExplorerLink = (hash: string): string | null => {
    if (!explorerUrl) return null;
    const baseUrl = explorerUrl.endsWith("/") ? explorerUrl : `${explorerUrl}/`;
    return `${baseUrl}${hash}`;
  };

  const truncateHash = (hash: string): string => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString();
  };

  const renderStatusBadge = () => {
    switch (state.status) {
      case "pending":
        return (
          <Badge variant="warning" aria-label="Transaction pending">
            {labels.pending}
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="success" aria-label="Transaction confirmed">
            {labels.confirmed}
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
          <Spinner size="sm" tone="neutral" label="Tracking transaction" />
        );
      case "confirmed":
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
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
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4 ${className}`}
      role="region"
      aria-label="Transaction status tracker"
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

      <div className="grid grid-cols-1 gap-2 text-sm">
        {showHash && (
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

        {showTimestamp && state.timestamp && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Last Updated
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {formatTimestamp(state.timestamp)}
            </span>
          </div>
        )}

        {state.status === "confirmed" && state.confirmations > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Confirmations
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {state.confirmations}
            </span>
          </div>
        )}

        {state.status === "confirmed" && state.gasUsed && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Gas Used
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {parseInt(state.gasUsed).toLocaleString()}
            </span>
          </div>
        )}

        {state.status === "confirmed" && state.blockNumber && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Block Number
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {state.blockNumber}
            </span>
          </div>
        )}
      </div>

      {isTracking && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Spinner size="xs" tone="neutral" />
          <span>
            {useWebSocket ? "WebSocket connected" : `Polling every ${pollingInterval / 1000}s`}
          </span>
        </div>
      )}
    </div>
  );
}

export default TransactionStatusTracker;
