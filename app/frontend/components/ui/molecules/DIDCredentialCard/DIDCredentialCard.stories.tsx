import type { Meta, StoryObj } from '@storybook/react';
import { DIDCredentialCard } from './DIDCredentialCard';

const meta: Meta<typeof DIDCredentialCard> = {
  title: 'Design System/Molecules/DIDCredentialCard',
  component: DIDCredentialCard,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DIDCredentialCard>;

export const VerifiedKYC: Story = {
  args: {
    credential: {
      id: 'cred-kyc-123',
      type: 'KYC Proof',
      status: 'verified',
      issuerName: 'Civic Pass Provider',
      issuerDid: 'did:key:z6Mkq5Ld8gV9p4K9s7tB8aC7d3f8g9h0',
      timestamp: '2026-06-20T10:00:00Z',
    },
  },
};

export const PendingEmail: Story = {
  args: {
    credential: {
      id: 'cred-email-456',
      type: 'Email Credential',
      status: 'pending',
      issuerName: 'Gatherraa Auth Server',
      issuerDid: 'did:web:gatherraa.com:auth',
      timestamp: '2026-06-24T12:00:00Z',
    },
  },
};

export const RevokedWallet: Story = {
  args: {
    credential: {
      id: 'cred-wallet-789',
      type: 'Wallet Ownership Proof',
      status: 'revoked',
      issuerName: 'Etherscan Verifier',
      issuerDid: 'did:ethr:0x1234567890123456789012345678901234567890',
      timestamp: '2026-06-01T15:30:00Z',
      revocationReason: 'Private key compromise reported by the wallet holder.',
    },
  },
};
