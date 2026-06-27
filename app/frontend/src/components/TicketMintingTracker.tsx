'use client';

import React, { useState } from 'react';
import { CheckCircle, Clock, Loader2, XCircle, RefreshCw, ExternalLink, Ticket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/atoms/Button/Button';
import { Progress } from '@/src/components/ui/progress';
import { MintingStatus, MintingState } from '../types/minting';
import { useTicketMinting } from '../hooks/useTicketMinting';

type StateConfigValue = { label: string; icon: React.ReactNode; color: string; bg: string; border: string; progress: number; };
type StateConfig = { [K in MintingState]: StateConfigValue };

const STATE_CONFIG: StateConfig = {
  pending: { label: 'Pending', icon: <Clock className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200/70 dark:border-amber-500/30', progress: 10 },
  processing: { label: 'Processing', icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200/70 dark:border-blue-500/30', progress: 60 },
  confirmed: { label: 'Confirmed', icon: <CheckCircle className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200/70 dark:border-emerald-500/30', progress: 100 },
  failed: { label: 'Failed', icon: <XCircle className="h-4 w-4" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200/70 dark:border-rose-500/30', progress: 0 },
};

function MintingCard({ status, onRetry, maxRetries = 3 }: { status: MintingStatus; onRetry: (id: string) => void; maxRetries?: number }) {
  const config = STATE_CONFIG[status.state];
  const canRetry = status.state === 'failed' && status.retryCount < maxRetries;
  const stellarExplorerUrl = status.txHash ? `https://stellar.expert/explorer/${status.stellarNetwork}/tx/${status.txHash}` : null;
  const shortHash = status.txHash ? `${status.txHash.slice(0, 8)}...${status.txHash.slice(-8)}` : null;

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${config.bg} ${config.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{status.ticketName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{status.eventName}</p>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.color}`}>
          {config.icon}
          {config.label}
        </div>
      </div>
      <div className="mt-4">
        <Progress value={config.progress} className="h-1.5" />
      </div>
      {shortHash && stellarExplorerUrl && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Tx:</span>
          <a href={stellarExplorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400">
            {shortHash}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {status.errorMessage && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{status.errorMessage}</p>
      )}
      {status.state === 'failed' && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Attempt {status.retryCount + 1} of {maxRetries + 1}</p>
          {canRetry ? (
            <Button size="sm" variant="secondary" onClick={() => onRetry(status.id)}>
              <RefreshCw className="mr-1.5 h-3 w-3" />Retry
            </Button>
          ) : (
            <span className="text-xs text-rose-500">Max retries reached</span>
          )}
        </div>
      )}
      <p className="mt-3 text-right text-xs text-slate-400 dark:text-slate-500">{status.updatedAt.toLocaleTimeString()}</p>
    </div>
  );
}

function MintForm({ onMint }: { onMint: (name: string, event: string) => void }) {
  const [ticketName, setTicketName] = useState('');
  const [eventName, setEventName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketName.trim() || !eventName.trim()) return;
    onMint(ticketName.trim(), eventName.trim());
    setTicketName('');
    setEventName('');
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/95">
      <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Mint a New Ticket</p>
      <div className="space-y-3">
        <input value={ticketName} onChange={(e) => setTicketName(e.target.value)} placeholder="Ticket name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        <Button type="submit" className="w-full">
          <Ticket className="mr-2 h-4 w-4" />Start Minting
        </Button>
      </div>
    </form>
  );
}

export default function TicketMintingTracker() {
  const { mintingStatuses, startMinting, retryMinting, clearAll } = useTicketMinting();

  const counts = {
    pending: mintingStatuses.filter((s) => s.state === 'pending').length,
    processing: mintingStatuses.filter((s) => s.state === 'processing').length,
    confirmed: mintingStatuses.filter((s) => s.state === 'confirmed').length,
    failed: mintingStatuses.filter((s) => s.state === 'failed').length,
  };

  return (
    <div className="space-y-6">
      {mintingStatuses.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Pending', counts.pending, 'text-amber-600'], ['Processing', counts.processing, 'text-blue-600'], ['Confirmed', counts.confirmed, 'text-emerald-600'], ['Failed', counts.failed, 'text-rose-600']] as const).map(([label, count, color]) => (
            <div key={label} className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-center shadow-sm dark:border-slate-700/60 dark:bg-slate-950/95">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Minting Queue</h2>
            {mintingStatuses.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Clear all
              </Button>
            )}
          </div>
          {mintingStatuses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
              <Ticket className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No minting jobs yet. Start one using the form.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mintingStatuses.map((status) => (
                <MintingCard key={status.id} status={status} onRetry={retryMinting} />
              ))}
            </div>
          )}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <MintForm onMint={startMinting} />
        </div>
      </div>
    </div>
  );
}
