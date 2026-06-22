'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui';

export type TransactionType = 'purchase' | 'transfer' | 'refund' | 'mint' | 'claim';
export type TxStatus = 'success' | 'pending' | 'failed';

export interface TxRecord {
  hash: string;
  type: TransactionType;
  status: TxStatus;
  timestamp: string;
  eventRef?: string;
  blockNumber?: number;
  explorerUrl?: string;
}

export interface TransactionHistoryPanelProps {
  transactions: TxRecord[];
  explorerBaseUrl?: string;
  className?: string;
}

const txTypeConfig: Record<TransactionType, { label: string; icon: typeof ArrowUpRight; color: string }> = {
  purchase: { label: 'Ticket Purchase', icon: ArrowDownLeft, color: 'text-blue-600' },
  transfer: { label: 'Transfer', icon: ArrowUpRight, color: 'text-purple-600' },
  refund: { label: 'Refund', icon: RefreshCw, color: 'text-orange-600' },
  mint: { label: 'Mint', icon: ArrowDownLeft, color: 'text-green-600' },
  claim: { label: 'Claim', icon: ArrowDownLeft, color: 'text-teal-600' },
};

function StatusIcon({ status }: { status: TxStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
  }
}

function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function TransactionHistoryPanel({
  transactions,
  explorerBaseUrl,
  className = '',
}: TransactionHistoryPanelProps) {
  if (transactions.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm ${className}`}>
        <p className="text-sm text-gray-500">No transactions found</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-800">Transaction History</h3>
        <p className="text-xs text-gray-500">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-gray-50">
        {transactions.map((tx, index) => {
          const config = txTypeConfig[tx.type];
          const TxIcon = config.icon;
          const explorerUrl = tx.explorerUrl || (explorerBaseUrl ? `${explorerBaseUrl}/tx/${tx.hash}` : null);

          return (
            <motion.div
              key={tx.hash}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              {/* Type Icon */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 ${config.color}`}>
                <TxIcon className="h-4 w-4" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{config.label}</span>
                  <StatusIcon status={tx.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-gray-500 font-mono">{shortenHash(tx.hash)}</code>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700"
                      title="View on explorer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {tx.eventRef && (
                  <span className="text-xs text-gray-400">Event: {tx.eventRef}</span>
                )}
              </div>

              {/* Timestamp */}
              <div className="text-right shrink-0">
                <span className="text-xs text-gray-500">
                  {new Date(tx.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <br />
                <span className="text-xs text-gray-400">
                  {new Date(tx.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default TransactionHistoryPanel;
