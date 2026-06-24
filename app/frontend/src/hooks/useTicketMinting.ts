import { useState, useCallback, useRef } from 'react';
import { MintingStatus, MintingState } from '../types/minting';

interface UseMintingOptions {
  onSuccess?: (status: MintingStatus) => void;
  onError?: (status: MintingStatus) => void;
  maxRetries?: number;
}

interface UseMintingReturn {
  mintingStatuses: MintingStatus[];
  startMinting: (ticketName: string, eventName: string) => string;
  retryMinting: (id: string) => void;
  clearAll: () => void;
}

const SIMULATED_DELAY = 1500;
const MAX_RETRIES = 3;

// Simulate Stellar transaction hash
const generateTxHash = () =>
  Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');

export const useTicketMinting = ({
  onSuccess,
  onError,
  maxRetries = MAX_RETRIES,
}: UseMintingOptions = {}): UseMintingReturn => {
  const [mintingStatuses, setMintingStatuses] = useState<MintingStatus[]>([]);
  const retryCountRef = useRef<Record<string, number>>({});

  const updateStatus = useCallback(
    (id: string, updates: Partial<MintingStatus>) => {
      setMintingStatuses((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
        ),
      );
    },
    [],
  );

  const processMinting = useCallback(
    async (id: string) => {
      // Move to processing
      updateStatus(id, { state: 'processing' });

      await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY));

      // Simulate 80% success rate
      const success = Math.random() > 0.2;

      if (success) {
        const txHash = generateTxHash();
        const updated: Partial<MintingStatus> = {
          state: 'confirmed',
          txHash,
        };
        updateStatus(id, updated);
        setMintingStatuses((prev) => {
          const found = prev.find((s) => s.id === id);
          if (found) onSuccess?.({ ...found, ...updated, updatedAt: new Date() });
          return prev;
        });
      } else {
        const updated: Partial<MintingStatus> = {
          state: 'failed',
          errorMessage: 'Transaction rejected by Stellar network. Please retry.',
        };
        updateStatus(id, updated);
        setMintingStatuses((prev) => {
          const found = prev.find((s) => s.id === id);
          if (found) onError?.({ ...found, ...updated, updatedAt: new Date() });
          return prev;
        });
      }
    },
    [updateStatus, onSuccess, onError],
  );

  const startMinting = useCallback(
    (ticketName: string, eventName: string): string => {
      const id = `mint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      retryCountRef.current[id] = 0;

      const newStatus: MintingStatus = {
        id,
        ticketName,
        eventName,
        state: 'pending',
        txHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        stellarNetwork: 'testnet',
      };

      setMintingStatuses((prev) => [newStatus, ...prev]);
      processMinting(id);
      return id;
    },
    [processMinting],
  );

  const retryMinting = useCallback(
    (id: string) => {
      const currentRetries = retryCountRef.current[id] ?? 0;
      if (currentRetries >= maxRetries) return;

      retryCountRef.current[id] = currentRetries + 1;
      updateStatus(id, {
        state: 'pending',
        errorMessage: undefined,
        retryCount: currentRetries + 1,
      });
      processMinting(id);
    },
    [maxRetries, updateStatus, processMinting],
  );

  const clearAll = useCallback(() => {
    setMintingStatuses([]);
    retryCountRef.current = {};
  }, []);

  return { mintingStatuses, startMinting, retryMinting, clearAll };
};
