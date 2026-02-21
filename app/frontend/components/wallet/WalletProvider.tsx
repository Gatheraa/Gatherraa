'use client';

import { ReactNode } from 'react';
import { WalletContext } from '@/lib/wallet/WalletContext';
import { useWallet } from '@/lib/wallet/useWallet';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}
