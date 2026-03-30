import { Wallet } from 'lucide-react';

function WalletNotConnected() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
      <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Wallet not connected</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Connect your wallet to apply for missions and track your rewards.
        </p>
      </div>
      <button className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
        Connect
      </button>
    </div>
  );
}

export default WalletNotConnected;