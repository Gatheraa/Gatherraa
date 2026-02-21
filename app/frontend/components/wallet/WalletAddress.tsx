'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';

interface WalletAddressProps {
  className?: string;
  showFull?: boolean;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletAddress({ className = '', showFull = false }: WalletAddressProps) {
  const { address, copyAddress } = useWalletContext();
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const handleCopy = async () => {
    const success = await copyAddress();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayAddress = showFull ? address : truncateAddress(address);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}
    >
      {/* Green dot indicator */}
      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />

      <span
        className="text-sm font-mono text-gray-700 dark:text-gray-300 select-all"
        title={address}
      >
        {displayAddress}
      </span>

      <button
        onClick={handleCopy}
        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label={copied ? 'Address copied!' : 'Copy address'}
        title={copied ? 'Copied!' : 'Copy address'}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
