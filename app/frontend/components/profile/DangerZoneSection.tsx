'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

type ConfirmAction = 'deactivate' | 'delete' | null;

const CONFIRM_TEXT: Record<NonNullable<ConfirmAction>, string> = {
  deactivate:
    'Your account will be hidden and all active sessions ended. You can reactivate by logging back in.',
  delete:
    'This is permanent. All your data, events, and tickets will be erased and cannot be recovered.',
};

export function DangerZoneSection() {
  const [confirming, setConfirming] = useState<ConfirmAction>(null);

  const handleConfirm = (action: NonNullable<ConfirmAction>) => {
    /* Wire to actual API calls once backend endpoints exist */
    console.warn(`User confirmed: ${action}`);
    setConfirming(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-error-muted)] border border-red-200 dark:border-red-900/40">
        <AlertTriangle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-error-muted-foreground)] leading-relaxed">
          Actions in this section are irreversible. Please read each description carefully before proceeding.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Deactivate account
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Temporarily disable your account. You can reactivate at any time.
          </p>
          {confirming === 'deactivate' ? (
            <ConfirmPrompt
              message={CONFIRM_TEXT.deactivate}
              onConfirm={() => handleConfirm('deactivate')}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming('deactivate')}
            >
              Deactivate
            </Button>
          )}
        </div>

        <div className="flex-1 p-4 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
          <p className="text-sm font-semibold text-[var(--color-error)] mb-1">
            Delete account
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Permanently delete your account and all associated data.
          </p>
          {confirming === 'delete' ? (
            <ConfirmPrompt
              message={CONFIRM_TEXT.delete}
              onConfirm={() => handleConfirm('delete')}
              onCancel={() => setConfirming(null)}
              destructive
            />
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirming('delete')}
            >
              Delete account
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConfirmPromptProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

function ConfirmPrompt({ message, onConfirm, onCancel, destructive }: ConfirmPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{message}</p>
      <div className="flex gap-2">
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
        >
          Confirm
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
