'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  FileText,
  ScanFace,
  Wallet,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  type VerificationStepItem,
  type VerificationStep,
  STEP_LABELS,
  STEP_DESCRIPTIONS,
} from '@/types/identity-verification';
import { StatusBadge } from './StatusBadge';

const STEP_ICON_MAP: Record<VerificationStep, React.ElementType> = {
  email: Mail,
  phone: Phone,
  government_id: FileText,
  face_match: ScanFace,
  wallet: Wallet,
  address: MapPin,
};

interface VerificationStepCardProps {
  step: VerificationStepItem;
  onRetry: (step: string) => Promise<void>;
  onSubmit: (step: string, metadata?: Record<string, any>) => Promise<void>;
}

export function VerificationStepCard({
  step,
  onRetry,
  onSubmit,
}: VerificationStepCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const Icon = STEP_ICON_MAP[step.step] || FileText;

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await onRetry(step.step);
    } finally {
      setIsLoading(false);
    }
  };

  const isActionable =
    step.status === 'pending' ||
    step.status === 'failed' ||
    step.status === 'expired';

  const isCompleted = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isInProgress = step.status === 'in_progress';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-white dark:bg-zinc-950 overflow-hidden transition-all ${
        isCompleted
          ? 'border-emerald-200 dark:border-emerald-900'
          : isFailed
            ? 'border-red-200 dark:border-red-900'
            : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              isCompleted
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                : isFailed
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                  : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isInProgress ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {STEP_LABELS[step.step]}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {STEP_DESCRIPTIONS[step.step]}
                </p>
              </div>
              <StatusBadge status={step.status} />
            </div>

            {isFailed && step.rejectionReason && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">
                  {step.rejectionReason}
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {step.attemptCount}/{step.maxAttempts} attempts
                </span>
                {!isCompleted && step.isRequired && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    Required
                  </span>
                )}
              </div>

              {isActionable && !isCompleted && (
                <button
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  {step.attemptCount > 0 ? 'Retry' : 'Start'}
                </button>
              )}

              {isInProgress && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing...
                </span>
              )}

              {isCompleted && step.completedAt && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Clock className="w-3 h-3" />
                  {new Date(step.completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
