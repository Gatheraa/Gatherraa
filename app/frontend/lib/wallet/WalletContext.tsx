'use client';

import { createContext, useContext } from 'react';
import { WalletContextValue } from '@/types/wallet';

export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWalletContext must be used inside <WalletProvider>');
  }
  return ctx;
}
