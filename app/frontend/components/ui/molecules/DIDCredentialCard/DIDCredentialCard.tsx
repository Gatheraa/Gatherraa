'use client';

import React from 'react';
import { Card } from '../Card';
import { Badge } from '../../atoms';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface DIDCredential {
  id: string;
  type: string;
  status: 'verified' | 'pending' | 'revoked';
  issuerName: string;
  issuerDid: string;
  timestamp: string | Date;
  revocationReason?: string;
}

export interface DIDCredentialCardProps {
  credential: DIDCredential;
  className?: string;
}

export function DIDCredentialCard({ credential, className = '' }: DIDCredentialCardProps) {
  const { type, status, issuerName, issuerDid, timestamp, revocationReason } = credential;

  // Map status to badge variant
  const statusBadgeVariant = {
    verified: 'success',
    pending: 'warning',
    revoked: 'error',
  }[status] as 'success' | 'warning' | 'error';

  // Format date safely
  const formattedDate = React.useMemo(() => {
    try {
      const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return dateObj.toLocaleDateString();
    } catch {
      return String(timestamp);
    }
  }, [timestamp]);

  return (
    <Card className={`relative flex flex-col justify-between p-5 min-h-[180px] w-full max-w-md ${className}`}>
      <div className="flex flex-col gap-4">
        {/* Header: Credential Type & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {status === 'verified' && (
              <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" aria-hidden="true" />
            )}
            {status === 'pending' && (
              <Shield className="w-5 h-5 text-[var(--color-warning)]" aria-hidden="true" />
            )}
            {status === 'revoked' && (
              <ShieldAlert className="w-5 h-5 text-[var(--color-error)]" aria-hidden="true" />
            )}
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {type}
            </h4>
          </div>
          <Badge variant={statusBadgeVariant}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Content: Issuer Information */}
        <div className="space-y-1.5">
          <div className="text-xs text-[var(--text-muted)] font-medium">Issuer</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{issuerName}</div>
          <div className="text-xs font-mono text-[var(--text-secondary)] break-all">{issuerDid}</div>
        </div>

        {/* Revocation Reason if status is revoked */}
        {status === 'revoked' && revocationReason && (
          <div className="p-3 rounded bg-[var(--color-error-muted)] text-[var(--color-error-muted-foreground)] text-xs border border-[var(--color-error)]/20">
            <span className="font-semibold block mb-0.5">Reason for Revocation:</span>
            {revocationReason}
          </div>
        )}
      </div>

      {/* Footer: Verification Timestamp */}
      <div className="mt-4 pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>Verified On</span>
        <time dateTime={new Date(timestamp).toISOString()}>{formattedDate}</time>
      </div>
    </Card>
  );
}
