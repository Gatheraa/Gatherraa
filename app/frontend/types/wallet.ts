export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface NetworkConfig {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  blockExplorer?: string;
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    currency: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    currency: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    currency: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
  },
  80001: {
    chainId: 80001,
    name: 'Mumbai Testnet',
    currency: 'MATIC',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
  },
};

// The chain IDs your dApp officially supports
export const ALLOWED_CHAIN_IDS = [1, 11155111, 137, 80001];

export interface WalletState {
  status: WalletConnectionStatus;
  address: string | null;
  chainId: number | null;
  isWrongNetwork: boolean;
  error: string | null;
}

export interface WalletContextValue extends WalletState {
  connect: (walletType?: WalletType) => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  copyAddress: () => Promise<boolean>;
}

export type WalletType = 'metamask' | 'coinbase' | 'walletconnect' | 'injected';

export interface WalletOption {
  id: WalletType;
  name: string;
  icon: string;
  description: string;
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Connect using MetaMask browser extension',
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🔵',
    description: 'Connect using Coinbase Wallet',
  },
  {
    id: 'injected',
    name: 'Browser Wallet',
    icon: '🌐',
    description: 'Connect using any injected wallet',
  },
];
