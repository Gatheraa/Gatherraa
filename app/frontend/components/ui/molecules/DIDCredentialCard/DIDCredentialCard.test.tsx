import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DIDCredentialCard, DIDCredential } from './DIDCredentialCard';

describe('DIDCredentialCard Component', () => {
  const mockVerifiedCredential: DIDCredential = {
    id: 'cred-1',
    type: 'KYC Proof',
    status: 'verified',
    issuerName: 'Civic Pass Provider',
    issuerDid: 'did:key:z6Mkq5Ld8gV9p4K9s7tB8aC7d3f8g9h0',
    timestamp: '2026-06-20T10:00:00Z',
  };

  const mockRevokedCredential: DIDCredential = {
    id: 'cred-2',
    type: 'Email Credential',
    status: 'revoked',
    issuerName: 'Gatherraa Auth Server',
    issuerDid: 'did:web:gatherraa.com:auth',
    timestamp: '2026-06-01T15:30:00Z',
    revocationReason: 'Email address was unverified by the owner.',
  };

  it('renders verified credential details correctly', () => {
    render(<DIDCredentialCard credential={mockVerifiedCredential} />);

    expect(screen.getByText('KYC Proof')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Civic Pass Provider')).toBeInTheDocument();
    expect(screen.getByText('did:key:z6Mkq5Ld8gV9p4K9s7tB8aC7d3f8g9h0')).toBeInTheDocument();
    expect(screen.getByText(/Verified On/i)).toBeInTheDocument();
  });

  it('renders revoked credential with warning and reason', () => {
    render(<DIDCredentialCard credential={mockRevokedCredential} />);

    expect(screen.getByText('Email Credential')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Reason for Revocation:')).toBeInTheDocument();
    expect(screen.getByText('Email address was unverified by the owner.')).toBeInTheDocument();
  });
});
