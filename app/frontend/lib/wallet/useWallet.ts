'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WalletState,
  WalletContextValue,
  WalletType,
  ALLOWED_CHAIN_IDS,
} from '@/types/wallet';

const STORAGE_KEY = 'gatherraa_wallet_connected';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

function getProvider(walletType?: WalletType) {
  if (typeof window === 'undefined') return null;

  const eth = window.ethereum;
  if (!eth) return null;

  if (walletType === 'metamask' && !eth.isMetaMask) return null;
  if (walletType === 'coinbase' && !eth.isCoinbaseWallet) return null;

  return eth;
}

export function useWallet(): WalletContextValue {
  const [state, setState] = useState<WalletState>({
    status: 'disconnected',
    address: null,
    chainId: null,
    isWrongNetwork: false,
    error: null,
  });

  const listenersAttached = useRef(false);

  const updateNetworkStatus = useCallback((chainId: number | null) => {
    const isWrongNetwork =
      chainId !== null && !ALLOWED_CHAIN_IDS.includes(chainId);
    setState((prev) => ({ ...prev, chainId, isWrongNetwork }));
  }, []);

  // Handle account changes from wallet
  const handleAccountsChanged = useCallback((accounts: unknown) => {
    const accs = accounts as string[];
    if (!accs || accs.length === 0) {
      setState({
        status: 'disconnected',
        address: null,
        chainId: null,
        isWrongNetwork: false,
        error: null,
      });
      localStorage.removeItem(STORAGE_KEY);
    } else {
      setState((prev) => ({ ...prev, address: accs[0], status: 'connected' }));
    }
  }, []);

  // Handle chain changes from wallet
  const handleChainChanged = useCallback(
    (chainIdHex: unknown) => {
      const chainId = parseInt(chainIdHex as string, 16);
      updateNetworkStatus(chainId);
    },
    [updateNetworkStatus],
  );

  // Attach / detach event listeners
  const attachListeners = useCallback(() => {
    const provider = getProvider();
    if (!provider || listenersAttached.current) return;
    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    listenersAttached.current = true;
  }, [handleAccountsChanged, handleChainChanged]);

  const detachListeners = useCallback(() => {
    const provider = getProvider();
    if (!provider || !listenersAttached.current) return;
    provider.removeListener('accountsChanged', handleAccountsChanged);
    provider.removeListener('chainChanged', handleChainChanged);
    listenersAttached.current = false;
  }, [handleAccountsChanged, handleChainChanged]);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem(STORAGE_KEY);
    if (!wasConnected) return;

    const provider = getProvider();
    if (!provider) return;

    (async () => {
      try {
        const accounts = (await provider.request({
          method: 'eth_accounts',
        })) as string[];

        if (accounts && accounts.length > 0) {
          const chainIdHex = (await provider.request({
            method: 'eth_chainId',
          })) as string;
          const chainId = parseInt(chainIdHex, 16);
          const isWrongNetwork = !ALLOWED_CHAIN_IDS.includes(chainId);

          setState({
            status: 'connected',
            address: accounts[0],
            chainId,
            isWrongNetwork,
            error: null,
          });
          attachListeners();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();

    return () => {
      detachListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    async (walletType?: WalletType) => {
      setState((prev) => ({ ...prev, status: 'connecting', error: null }));

      const provider = getProvider(walletType);

      if (!provider) {
        const walletName =
          walletType === 'metamask'
            ? 'MetaMask'
            : walletType === 'coinbase'
              ? 'Coinbase Wallet'
              : 'a Web3 wallet';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: `${walletName} is not installed. Please install it and try again.`,
        }));
        return;
      }

      try {
        const accounts = (await provider.request({
          method: 'eth_requestAccounts',
        })) as string[];

        const chainIdHex = (await provider.request({
          method: 'eth_chainId',
        })) as string;
        const chainId = parseInt(chainIdHex, 16);
        const isWrongNetwork = !ALLOWED_CHAIN_IDS.includes(chainId);

        setState({
          status: 'connected',
          address: accounts[0],
          chainId,
          isWrongNetwork,
          error: null,
        });

        localStorage.setItem(STORAGE_KEY, 'true');
        attachListeners();
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (error.code === 4001) {
          // User rejected the request
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Connection rejected. Please approve the connection in your wallet.',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error.message || 'Failed to connect wallet. Please try again.',
          }));
        }
      }
    },
    [attachListeners],
  );

  const disconnect = useCallback(() => {
    detachListeners();
    localStorage.removeItem(STORAGE_KEY);
    setState({
      status: 'disconnected',
      address: null,
      chainId: null,
      isWrongNetwork: false,
      error: null,
    });
  }, [detachListeners]);

  const switchNetwork = useCallback(
    async (chainId: number) => {
      const provider = getProvider();
      if (!provider) return;

      const chainIdHex = `0x${chainId.toString(16)}`;

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        // Chain not added to wallet yet (error code 4902)
        if (error.code === 4902) {
          setState((prev) => ({
            ...prev,
            error: 'This network is not added to your wallet. Please add it manually.',
          }));
        } else if (error.code !== 4001) {
          setState((prev) => ({
            ...prev,
            error: error.message || 'Failed to switch network.',
          }));
        }
      }
    },
    [],
  );

  const copyAddress = useCallback(async (): Promise<boolean> => {
    if (!state.address) return false;
    try {
      await navigator.clipboard.writeText(state.address);
      return true;
    } catch {
      return false;
    }
  }, [state.address]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    copyAddress,
  };
}
