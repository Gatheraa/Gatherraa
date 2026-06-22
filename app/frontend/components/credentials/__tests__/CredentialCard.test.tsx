import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CredentialCard, type DIDCredential } from '@/components/credentials/CredentialCard';

const mockCredential: DIDCredential = {
  id: 'did:example:1234567890abcdef',
  type: 'email',
  issuer: 'Gatherraa Identity',
  verifiedAt: '2026-06-15T10:30:00Z',
  status: 'verified',
  details: 'Primary email credential',
};

describe('CredentialCard', () => {
  it('renders credential type and issuer', () => {
    render(<CredentialCard credential={mockCredential} />);
    expect(screen.getByText('Email Verified')).toBeInTheDocument();
    expect(screen.getByText('Gatherraa Identity')).toBeInTheDocument();
  });

  it('shows verified badge for verified credentials', () => {
    render(<CredentialCard credential={mockCredential} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows revoked badge for revoked credentials', () => {
    render(<CredentialCard credential={{ ...mockCredential, status: 'revoked' }} />);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText(/revoked by the issuer/i)).toBeInTheDocument();
  });

  it('shows pending badge for pending credentials', () => {
    render(<CredentialCard credential={{ ...mockCredential, status: 'pending' }} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows expired badge for expired credentials', () => {
    render(<CredentialCard credential={{ ...mockCredential, status: 'expired' }} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders wallet credential type', () => {
    render(<CredentialCard credential={{ ...mockCredential, type: 'wallet' }} />);
    expect(screen.getByText('Wallet Ownership')).toBeInTheDocument();
  });

  it('renders KYC credential type', () => {
    render(<CredentialCard credential={{ ...mockCredential, type: 'kyc' }} />);
    expect(screen.getByText('KYC Proof')).toBeInTheDocument();
  });

  it('displays verification date', () => {
    render(<CredentialCard credential={mockCredential} />);
    expect(screen.getByText(/Jun 15, 2026/)).toBeInTheDocument();
  });

  it('displays expiration date when provided', () => {
    render(<CredentialCard credential={{ ...mockCredential, expiresAt: '2027-06-15T10:30:00Z' }} />);
    expect(screen.getByText(/Expires: Jun 15, 2027/)).toBeInTheDocument();
  });

  it('shows issuer link when issuerUrl is provided', () => {
    render(<CredentialCard credential={{ ...mockCredential, issuerUrl: 'https://gatherraa.com' }} />);
    const link = screen.getByTitle('View on explorer');
    expect(link).toHaveAttribute('href', 'https://gatherraa.com');
  });
});
