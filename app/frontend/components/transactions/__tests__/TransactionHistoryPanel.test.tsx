import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionHistoryPanel, type TxRecord } from '@/components/transactions/TransactionHistoryPanel';

const mockTransactions: TxRecord[] = [
  {
    hash: '0xabcdef1234567890abcdef1234567890abcdef12',
    type: 'purchase',
    status: 'success',
    timestamp: '2026-06-20T14:30:00Z',
    eventRef: 'ETH Lagos 2026',
  },
  {
    hash: '0x1234567890abcdef1234567890abcdef12345678',
    type: 'transfer',
    status: 'pending',
    timestamp: '2026-06-21T09:15:00Z',
  },
  {
    hash: '0x9876543210fedcba9876543210fedcba98765432',
    type: 'refund',
    status: 'failed',
    timestamp: '2026-06-19T16:45:00Z',
    eventRef: 'DevCon Summit',
  },
];

describe('TransactionHistoryPanel', () => {
  it('renders transaction count in header', () => {
    render(<TransactionHistoryPanel transactions={mockTransactions} />);
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
  });

  it('renders all transaction types', () => {
    render(<TransactionHistoryPanel transactions={mockTransactions} />);
    expect(screen.getByText('Ticket Purchase')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();
  });

  it('displays shortened transaction hashes', () => {
    render(<TransactionHistoryPanel transactions={mockTransactions} />);
    expect(screen.getByText('0xabcdef...abcdef12')).toBeInTheDocument();
  });

  it('shows event references when provided', () => {
    render(<TransactionHistoryPanel transactions={mockTransactions} />);
    expect(screen.getByText('Event: ETH Lagos 2026')).toBeInTheDocument();
    expect(screen.getByText('Event: DevCon Summit')).toBeInTheDocument();
  });

  it('renders empty state when no transactions', () => {
    render(<TransactionHistoryPanel transactions={[]} />);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('shows singular "transaction" for single item', () => {
    render(<TransactionHistoryPanel transactions={[mockTransactions[0]]} />);
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
  });

  it('renders explorer links when baseUrl provided', () => {
    render(
      <TransactionHistoryPanel
        transactions={[mockTransactions[0]]}
        explorerBaseUrl="https://etherscan.io"
      />
    );
    const link = screen.getByTitle('View on explorer');
    expect(link).toHaveAttribute('href', 'https://etherscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('uses custom explorerUrl when provided', () => {
    const txWithCustomExplorer: TxRecord = {
      ...mockTransactions[0],
      explorerUrl: 'https://custom.explorer/tx/abc',
    };
    render(<TransactionHistoryPanel transactions={[txWithCustomExplorer]} />);
    const link = screen.getByTitle('View on explorer');
    expect(link).toHaveAttribute('href', 'https://custom.explorer/tx/abc');
  });
});
