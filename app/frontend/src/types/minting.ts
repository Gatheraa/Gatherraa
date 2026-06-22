export type MintingState = 'pending' | 'processing' | 'confirmed' | 'failed';

export interface MintingStatus {
  id: string;
  ticketName: string;
  eventName: string;
  state: MintingState;
  txHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  retryCount: number;
  stellarNetwork: 'mainnet' | 'testnet';
}
