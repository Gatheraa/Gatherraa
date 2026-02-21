'use client';

import { useEffect, useRef } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useWalletContext } from '@/lib/wallet/WalletContext';
import { WALLET_OPTIONS, WalletType } from '@/types/wallet';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const { connect, status, error } = useWalletContext();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close modal when connected successfully
  useEffect(() => {
    if (status === 'connected') {
      onClose();
    }
  }, [status, onClose]);

  if (!isOpen) return null;

  const handleWalletSelect = async (walletType: WalletType) => {
    await connect(walletType);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const isConnecting = status === 'connecting';

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-wallet-title"
    >
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2
              id="connect-wallet-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              Connect Wallet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Choose your preferred wallet to continue
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Wallet Options */}
        <div className="p-6 space-y-3">
          {WALLET_OPTIONS.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleWalletSelect(wallet.id)}
              disabled={isConnecting}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="text-3xl" role="img" aria-label={wallet.name}>
                {wallet.icon}
              </span>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {wallet.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {wallet.description}
                </p>
              </div>
              {isConnecting ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : (
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            By connecting, you agree to our{' '}
            <a href="#" className="text-blue-500 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-500 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Loading Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex flex-col items-center justify-center gap-3 rounded-2xl">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Connecting to wallet…
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Please approve the request in your wallet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
