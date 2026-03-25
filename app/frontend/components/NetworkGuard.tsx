"use client";

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff, X } from "lucide-react";

// ─── Network Registry ─────────────────────────────────────────────────────────

export const NETWORKS: Record<
  number,
  { name: string; currency: string; rpcUrl: string }
> = {
  1: {
    name: "Ethereum Mainnet",
    currency: "ETH",
    rpcUrl: "https://mainnet.infura.io/v3/",
  },
  11155111: {
    name: "Sepolia Testnet",
    currency: "ETH",
    rpcUrl: "https://sepolia.infura.io/v3/",
  },
  137: {
    name: "Polygon",
    currency: "MATIC",
    rpcUrl: "https://polygon-rpc.com",
  },
  8453: { name: "Base", currency: "ETH", rpcUrl: "https://mainnet.base.org" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type NetworkStatus = "loading" | "no-wallet" | "correct" | "wrong";

interface NetworkGuardProps {
  /** Chain ID(s) that are allowed. Defaults to Sepolia (11155111). */
  allowedChainIds?: number[];
  /** Content to render when network is correct */
  children: React.ReactNode;
  /** Override the banner title */
  bannerTitle?: string;
}

interface NetworkState {
  status: NetworkStatus;
  currentChainId: number | null;
  isSwitching: boolean;
}

// ─── Context (optional — lets children read network state) ────────────────────

const NetworkGuardContext = createContext<{ chainId: number | null } | null>(
  null,
);
export const useNetworkGuard = () => useContext(NetworkGuardContext);

// ─── Mock Web3 Helpers ────────────────────────────────────────────────────────

/** Returns a mock current chain ID. Change this to simulate different states. */
async function mockGetChainId(): Promise<number | null> {
  await new Promise((r) => setTimeout(r, 800));
  // Simulates: no wallet → null | wrong network → 137 | correct → 11155111
  // Toggle these to test different states:
  return 137; // wrong network (Polygon)
  // return 11155111; // correct (Sepolia)
  // return null;     // no wallet
}

/** Simulates wallet_switchEthereumChain */
async function mockSwitchNetwork(chainId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 1500));
  if (Math.random() < 0.2) throw new Error("User rejected the network switch.");
  // In real implementation, window.ethereum.request({ method: 'wallet_switchEthereumChain', ... })
}

// ─── Banner ───────────────────────────────────────────────────────────────────

interface NetworkBannerProps {
  currentChainId: number | null;
  allowedChainIds: number[];
  isSwitching: boolean;
  switchError: string | null;
  onSwitch: (chainId: number) => void;
  onDismissError: () => void;
  bannerTitle?: string;
}

function NetworkBanner({
  currentChainId,
  allowedChainIds,
  isSwitching,
  switchError,
  onSwitch,
  onDismissError,
  bannerTitle,
}: NetworkBannerProps) {
  const currentName = currentChainId
    ? (NETWORKS[currentChainId]?.name ?? `Chain ${currentChainId}`)
    : "Unknown Network";
  const primaryChain = allowedChainIds[0];
  const primaryName = NETWORKS[primaryChain]?.name ?? `Chain ${primaryChain}`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800/60 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: icon + message */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="shrink-0 mt-0.5 sm:mt-0 w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              {bannerTitle ?? "Wrong Network Detected"}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400/80 mt-0.5">
              You're on{" "}
              <span className="font-mono font-semibold">{currentName}</span>.{" "}
              Switch to{" "}
              <span className="font-mono font-semibold">{primaryName}</span> to
              continue.
            </p>
          </div>
        </div>

        {/* Right: switch buttons */}
        <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
          {allowedChainIds.map((chainId) => (
            <button
              key={chainId}
              onClick={() => onSwitch(chainId)}
              disabled={isSwitching}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                "border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-400",
                isSwitching
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 border-yellow-200 dark:border-yellow-700 cursor-not-allowed opacity-70"
                  : "bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white border-transparent shadow-sm",
              ].join(" ")}
            >
              {isSwitching ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Wifi className="w-3 h-3" />
              )}
              {isSwitching
                ? "Switching…"
                : `Switch to ${NETWORKS[chainId]?.name ?? `Chain ${chainId}`}`}
            </button>
          ))}
        </div>
      </div>

      {/* Switch error sub-bar */}
      {switchError && (
        <div className="max-w-7xl mx-auto mt-2 flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            {switchError}
          </p>
          <button
            onClick={onDismissError}
            className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── No Wallet Banner ─────────────────────────────────────────────────────────

function NoWalletBanner() {
  return (
    <div
      role="alert"
      className="w-full bg-gray-100 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center">
          <WifiOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            No Wallet Detected
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Install a Web3 wallet like MetaMask to interact with this page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NetworkGuard({
  allowedChainIds = [11155111], // Default: Sepolia
  children,
  bannerTitle,
}: NetworkGuardProps) {
  const [network, setNetwork] = useState<NetworkState>({
    status: "loading",
    currentChainId: null,
    isSwitching: false,
  });
  const [switchError, setSwitchError] = useState<string | null>(null);

  // ── Detect current network on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    mockGetChainId().then((chainId) => {
      if (cancelled) return;
      if (chainId === null) {
        setNetwork({
          status: "no-wallet",
          currentChainId: null,
          isSwitching: false,
        });
      } else if (allowedChainIds.includes(chainId)) {
        setNetwork({
          status: "correct",
          currentChainId: chainId,
          isSwitching: false,
        });
      } else {
        setNetwork({
          status: "wrong",
          currentChainId: chainId,
          isSwitching: false,
        });
      }
    });

    // In production, also listen for chainChanged:
    // window.ethereum?.on('chainChanged', handleChainChange)

    return () => {
      cancelled = true;
    };
  }, [allowedChainIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch network handler ──────────────────────────────────────────────────
  const handleSwitch = useCallback(async (targetChainId: number) => {
    setSwitchError(null);
    setNetwork((prev) => ({ ...prev, isSwitching: true }));

    try {
      await mockSwitchNetwork(targetChainId);
      setNetwork({
        status: "correct",
        currentChainId: targetChainId,
        isSwitching: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network switch failed.";
      setSwitchError(msg);
      setNetwork((prev) => ({ ...prev, isSwitching: false }));
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <NetworkGuardContext.Provider value={{ chainId: network.currentChainId }}>
      {/* Loading skeleton bar */}
      {network.status === "loading" && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-indigo-500 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full" />
        </div>
      )}

      {/* No wallet */}
      {network.status === "no-wallet" && <NoWalletBanner />}

      {/* Wrong network */}
      {network.status === "wrong" && (
        <NetworkBanner
          currentChainId={network.currentChainId}
          allowedChainIds={allowedChainIds}
          isSwitching={network.isSwitching}
          switchError={switchError}
          onSwitch={handleSwitch}
          onDismissError={() => setSwitchError(null)}
          bannerTitle={bannerTitle}
        />
      )}

      {/* Always render children — banner sits above */}
      {children}
    </NetworkGuardContext.Provider>
  );
}
