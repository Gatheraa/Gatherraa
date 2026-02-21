'use client';

import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, LogOut, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';
import { ConnectWalletModal } from './ConnectWalletModal';
import { SUPPORTED_NETWORKS } from '@/types/wallet';

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { status, address, chainId, isWrongNetwork, disconnect, copyAddress } =
    useWalletContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleCopy = async () => {
    const success = await copyAddress();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    setDropdownOpen(false);
    disconnect();
  };

  // ── Disconnected state ──────────────────────────────────────────────────────
  if (status === 'disconnected' || status === 'error') {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>
        <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // ── Connecting state ────────────────────────────────────────────────────────
  if (status === 'connecting') {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/70 text-white text-sm font-semibold rounded-xl shadow-sm cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting…
      </button>
    );
  }

  // ── Connected state ─────────────────────────────────────────────────────────
  const networkName =
    chainId && SUPPORTED_NETWORKS[chainId]
      ? SUPPORTED_NETWORKS[chainId].name
      : chainId
        ? `Chain ${chainId}`
        : null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isWrongNetwork
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 focus:ring-amber-400'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-blue-500'
          }`}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {/* Network / wrong-network indicator */}
          {isWrongNetwork ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
          )}

          {/* Address */}
          <span className="font-mono">{address ? truncateAddress(address) : '—'}</span>

          {/* Network badge */}
          {networkName && !isWrongNetwork && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md">
              {networkName}
            </span>
          )}

          {isWrongNetwork && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-md font-semibold">
              Wrong Network
            </span>
          )}

          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-40 overflow-hidden">
            {/* Address section */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connected Address</p>
              <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                {address}
              </p>
            </div>

            {/* Network section */}
            {networkName && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Network</p>
                <div className="flex items-center gap-2">
                  {isWrongNetwork ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      isWrongNetwork
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {networkName}
                    {isWrongNetwork && ' (Unsupported)'}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Address Copied!' : 'Copy Address'}
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connect modal (re-open if needed) */}
      <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
