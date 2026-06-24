'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { VerificationStepItem } from '@/types/identity-verification';
import { VerificationStepCard } from './VerificationStepCard';

interface VerificationStepsProps {
  steps: VerificationStepItem[];
  onRetry: (step: string) => Promise<void>;
  onSubmit: (step: string, metadata?: Record<string, any>) => Promise<void>;
}

export function VerificationSteps({
  steps,
  onRetry,
  onSubmit,
}: VerificationStepsProps) {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const total = steps.length;

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No verification steps configured
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Verification steps will appear once initialized.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>
            {completed}/{total} complete
          </span>
        </div>
        {failed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {failed}/{total} failed
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <VerificationStepCard
                key={step.id}
                step={step}
                onRetry={onRetry}
                onSubmit={onSubmit}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
