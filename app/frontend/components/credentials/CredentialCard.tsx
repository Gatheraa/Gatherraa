'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui';

export type CredentialType = 'email' | 'wallet' | 'kyc' | 'phone' | 'social' | 'custom';
export type VerificationStatus = 'verified' | 'pending' | 'revoked' | 'expired';

export interface DIDCredential {
  id: string;
  type: CredentialType;
  issuer: string;
  issuerUrl?: string;
  verifiedAt: string;
  expiresAt?: string;
  status: VerificationStatus;
  details?: string;
}

export interface CredentialCardProps {
  credential: DIDCredential;
  className?: string;
}

const credentialTypeLabels: Record<CredentialType, string> = {
  email: 'Email Verified',
  wallet: 'Wallet Ownership',
  kyc: 'KYC Proof',
  phone: 'Phone Verified',
  social: 'Social Identity',
  custom: 'Custom Credential',
};

const credentialTypeIcons: Record<CredentialType, string> = {
  email: '📧',
  wallet: '👛',
  kyc: '🪪',
  phone: '📱',
  social: '👤',
  custom: '🔖',
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  switch (status) {
    case 'verified':
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Verified
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'revoked':
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Revoked
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Expired
        </Badge>
      );
  }
}

export function CredentialCard({ credential, className = '' }: CredentialCardProps) {
  const isRevoked = credential.status === 'revoked';
  const isExpired = credential.status === 'expired';

  return (
    <motion.div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
        isRevoked
          ? 'border-red-200 bg-red-50/50'
          : isExpired
          ? 'border-gray-200 bg-gray-50/50'
          : 'border-gray-200 hover:shadow-md'
      } ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg">
            {credentialTypeIcons[credential.type]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {credentialTypeLabels[credential.type]}
            </h3>
            <p className="text-xs text-gray-500">ID: {credential.id.slice(0, 12)}...</p>
          </div>
        </div>
        <StatusBadge status={credential.status} />
      </div>

      {/* Issuer */}
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-600">Issued by:</span>
        <span className="text-sm font-medium text-gray-800">{credential.issuer}</span>
        {credential.issuerUrl && (
          <a
            href={credential.issuerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          Verified: {new Date(credential.verifiedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {credential.expiresAt && (
          <span>
            Expires: {new Date(credential.expiresAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Details */}
      {credential.details && (
        <p className="mt-2 text-xs text-gray-500">{credential.details}</p>
      )}

      {/* Revocation warning */}
      {isRevoked && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
          <XCircle className="h-4 w-4" />
          This credential has been revoked by the issuer.
        </div>
      )}
    </motion.div>
  );
}

export default CredentialCard;
