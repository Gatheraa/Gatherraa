'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  WalletConnectionStatus,
  WalletState,
  WalletContextValue,
  WalletType,
  ALLOWED_CHAIN_IDS,
  SUPPORTED_NETWORKS,
} from '@/types/wallet';

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [state, setState] = useState<WalletState>({
    status: 'disconnected',
    address: null,
    chainId: null,
    isWrongNetwork: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<WalletState>) => {
    setState((prev) => {
      const updated = { ...prev, ...updates };
      const isWrongNetwork =
        updated.chainId !== null && !ALLOWED_CHAIN_IDS.includes(updated.chainId);
      return { ...updated, isWrongNetwork };
    });
  }, []);

  const getEthereumProvider = () => {
    if (typeof window !== 'undefined' && 'ethereum' in window) {
      return (window as unknown as { ethereum: any }).ethereum;
    }
    return null;
  };

  const connect = useCallback(async (walletType?: WalletType) => {
    const ethereum = getEthereumProvider();

    if (!ethereum) {
      updateState({
        status: 'error',
        error: 'No web3 provider found. Please install MetaMask or another browser wallet.',
      });
      return;
    }

    updateState({ status: 'connecting', error: null });

    try {
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const chainIdHex = (await ethereum.request({
        method: 'eth_chainId',
      })) as string;

      const chainId = parseInt(chainIdHex, 16);

      updateState({
        status: 'connected',
        address: accounts[0] || null,
        chainId,
        error: null,
      });
    } catch (err: any) {
      updateState({
        status: 'error',
        error: err?.message || 'Failed to connect wallet.',
      });
    }
  }, [updateState]);

  const disconnect = useCallback(() => {
    setState({
      status: 'disconnected',
      address: null,
      chainId: null,
      isWrongNetwork: false,
      error: null,
    });
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const hexChainId = `0x${targetChainId.toString(16)}`;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      // 4902 indicates chain is not added to wallet
      if (switchError.code === 4902 && SUPPORTED_NETWORKS[targetChainId]) {
        const network = SUPPORTED_NETWORKS[targetChainId];
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: network.name,
                nativeCurrency: {
                  name: network.currency,
                  symbol: network.currency,
                  decimals: 18,
                },
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: network.blockExplorer
                  ? [network.blockExplorer]
                  : undefined,
              },
            ],
          });
        } catch (addError: any) {
          updateState({ error: addError?.message || 'Failed to add network.' });
        }
      } else {
        updateState({ error: switchError?.message || 'Failed to switch network.' });
      }
    }
  }, [updateState]);

  const copyAddress = useCallback(async (): Promise<boolean> => {
    if (!state.address) return false;
    try {
      await navigator.clipboard.writeText(state.address);
      return true;
    } catch {
      return false;
    }
  }, [state.address]);

  // Listen for account and network changes automatically
  useEffect(() => {
    const ethereum = getEthereumProvider();
    if (!ethereum || !ethereum.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        updateState({ address: accounts[0], status: 'connected' });
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      updateState({ chainId });
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [disconnect, updateState]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        switchNetwork,
        copyAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};