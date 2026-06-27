import React, { useState, useEffect, useMemo } from 'react';

interface TicketOwnershipWidgetProps {
  ticketAssetCode?: string; // e.g., "VITA_TKT" or a specific Soroban Contract ID
  connectedWalletAddress: string | null; // Aligned to global wallet state layer
  onVerificationComplete?: (isOwner: boolean) => void;
}

type VerificationState = 'DISCONNECTED' | 'IDLE' | 'LOADING' | 'VERIFIED_OWNER' | 'VERIFIED_NON_OWNER' | 'ERROR';

export const TicketOwnershipWidget: React.FC<TicketOwnershipWidgetProps> = ({
  ticketAssetCode = 'VITA_TKT_2026',
  connectedWalletAddress,
  onVerificationComplete,
}) => {
  // 1. Core Component States
  const [status, setStatus] = useState<VerificationState>('DISCONNECTED');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<{ balance: number; tier: string } | null>(null);

  // 2. React smoothly to changes in the wallet connection lifecycle
  useEffect(() => {
    if (!connectedWalletAddress) {
      setStatus('DISCONNECTED');
      setTicketDetails(null);
      setErrorMessage(null);
    } else {
      setStatus('IDLE');
    }
  }, [connectedWalletAddress]);

  // 3. Stellar/Soroban Ledger Balance Resolution Simulation
  const verifyOwnershipOnChain = async () => {
    if (!connectedWalletAddress) return;

    setStatus('LOADING');
    setErrorMessage(null);

    try {
      // Real Blockchain Query Placeholder:
      // Replace this mock with your actual Stellar SDK / Soroban Client fetch mechanism:
      // const account = await server.loadAccount(connectedWalletAddress);
      // const balance = account.balances.find(b => b.asset_code === ticketAssetCode);
      
      await new Promise((resolve) => setTimeout(resolve, 1400)); // Simulated RPC latency

      // For test/preview purposes, let's treat any address starting with "G" as a ticket holder
      const mockHasTicket = connectedWalletAddress.toUpperCase().startsWith('G');

      if (connectedWalletAddress.length < 20) {
        throw new Error('Invalid cryptographic keypair address format.');
      }

      if (mockHasTicket) {
        const payload = { balance: 1, tier: 'VIP Access Pass' };
        setTicketDetails(payload);
        setStatus('VERIFIED_OWNER');
        if (onVerificationComplete) onVerificationComplete(true);
      } else {
        setTicketDetails({ balance: 0, tier: 'None' });
        setStatus('VERIFIED_NON_OWNER');
        if (onVerificationComplete) onVerificationComplete(false);
      }

    } catch (err: any) {
      setErrorMessage(err.message || 'Network exception reading Soroban instance storage cells.');
      setStatus('ERROR');
      if (onVerificationComplete) onVerificationComplete(false);
    }
  };

  // 4. Compute layout presentation configurations based on the internal state machine
  const cardConfig = useMemo(() => {
    switch (status) {
      case 'DISCONNECTED':
        return {
          bg: 'bg-gray-50 border-gray-200',
          title: 'Wallet Disconnected',
          desc: 'Please connect your Stellar active wallet to authenticate ticket credentials.',
          icon: '🔌',
        };
      case 'IDLE':
        return {
          bg: 'bg-white border-blue-100 hover:border-blue-200',
          title: 'Ticket Validation Available',
          desc: `Ready to evaluate ledger balance records for structural asset: ${ticketAssetCode}`,
          icon: '🎟️',
        };
      case 'LOADING':
        return {
          bg: 'bg-blue-50/50 border-blue-200 animate-pulse',
          title: 'Interrogating Network...',
          desc: 'Querying live smart contract multi-signer index registries.',
          icon: '🔄',
        };
      case 'VERIFIED_OWNER':
        return {
          bg: 'bg-emerald-50/60 border-emerald-200 shadow-sm',
          title: 'Ownership Cryptographically Verified',
          desc: `Valid access token confirmed. Authorized for event check-in admittance.`,
          icon: '✅',
        };
      case 'VERIFIED_NON_OWNER':
        return {
          bg: 'bg-amber-50/60 border-amber-200',
          title: 'No Valid Access Token Located',
          desc: 'The connected wallet address does not register ownership of this ticket tier resource.',
          icon: '⚠️',
        };
      case 'ERROR':
        return {
          bg: 'bg-rose-50/60 border-rose-200',
          title: 'Verification Operation Halted',
          desc: errorMessage || 'An unexpected error disrupted the pipeline.',
          icon: '❌',
        };
    }
  }, [status, errorMessage, ticketAssetCode]);

  return (
    <div className={`border rounded-2xl p-5 transition-all duration-300 max-w-md mx-auto ${cardConfig.bg}`}>
      <div className="flex items-start space-x-4">
        <span className="text-2xl mt-0.5">{cardConfig.icon}</span>
        <div className="space-y-1 flex-1">
          <h3 className="font-bold text-gray-900 text-sm md:text-base tracking-tight">
            {cardConfig.title}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            {cardConfig.desc}
          </p>

          {/* Connected Identity Meta Metrics */}
          {connectedWalletAddress && (
            <div className="pt-2 flex items-center space-x-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Account:</span>
              <span className="text-[11px] font-mono font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                {`${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-6)}`}
              </span>
            </div>
          )}

          {/* Conditional Output Content Fields */}
          {status === 'VERIFIED_OWNER' && ticketDetails && (
            <div className="mt-3 p-3 bg-white/80 rounded-xl border border-emerald-100 flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-emerald-900">{ticketDetails.tier}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">Asset ID: {ticketAssetCode}</p>
              </div>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Qty: {ticketDetails.balance}
              </span>
            </div>
          )}

          {/* Core Procedural Button Interactivity */}
          {status !== 'DISCONNECTED' && status !== 'LOADING' && (
            <div className="pt-3">
              <button
                onClick={verifyOwnershipOnChain}
                className={`w-full text-center py-2 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm ${
                  status === 'VERIFIED_OWNER'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : status === 'VERIFIED_NON_OWNER' || status === 'ERROR'
                    ? 'bg-gray-800 hover:bg-gray-900 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {status === 'IDLE' ? 'Verify Ownership Status' : 'Re-verify Balance Hooks'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};