'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';
import { SUPPORTED_NETWORKS, ALLOWED_CHAIN_IDS } from '@/types/wallet';

export function WrongNetworkAlert() {
  const { isWrongNetwork, chainId, switchNetwork } = useWalletContext();

  if (!isWrongNetwork) return null;

  const currentNetworkName =
    chainId && SUPPORTED_NETWORKS[chainId]
      ? SUPPORTED_NETWORKS[chainId].name
      : chainId
        ? `Chain ID ${chainId}`
        : 'Unknown Network';

  // Default to Sepolia testnet as the recommended network
  const recommendedChainId = 11155111;
  const recommendedNetwork = SUPPORTED_NETWORKS[recommendedChainId];

  return (
    <div
      role="alert"
      className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Wrong Network Detected
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
            You are connected to{' '}
            <span className="font-medium">{currentNetworkName}</span>. Please
            switch to a supported network.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {ALLOWED_CHAIN_IDS.map((id) => {
              const network = SUPPORTED_NETWORKS[id];
              if (!network) return null;
              return (
                <button
                  key={id}
                  onClick={() => switchNetwork(id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-700/60 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-300 dark:border-amber-600 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Switch to {network.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommended network hint */}
      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 pl-8">
        Recommended:{' '}
        <button
          onClick={() => switchNetwork(recommendedChainId)}
          className="underline hover:no-underline font-medium"
        >
          {recommendedNetwork.name}
        </button>
      </p>
    </div>
  );
}
