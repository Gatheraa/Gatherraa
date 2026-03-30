'use client';

import { Wallet, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnector() {
  const { status, address, error, connect, disconnect } = useWalletContext();

  if (status === 'connecting') {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/70 text-white text-sm font-semibold rounded-xl cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting…
      </button>
    );
  }

  if (status === 'connected' && address) {
    return (
      <div className="inline-flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
        <span className="text-sm font-mono text-gray-700 dark:text-gray-200">
          {truncateAddress(address)}
        </span>
        <button
          onClick={disconnect}
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Disconnect wallet"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={() => connect()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
      {status === 'error' && error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
