import { render, screen, waitFor } from '@testing-library/react';
import { TransactionStatusTracker } from './TransactionStatusTracker';

// Mock ethers provider
const mockProvider = {
  getTransactionReceipt: jest.fn(),
};

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as any;

describe('TransactionStatusTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    provider: mockProvider,
  };

  it('renders with pending status initially', () => {
    render(<TransactionStatusTracker {...defaultProps} />);
    
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Transaction status tracker' })).toBeInTheDocument();
  });

  it('displays transaction hash when showHash is true', () => {
    render(<TransactionStatusTracker {...defaultProps} showHash={true} />);
    
    const hashElement = screen.getByText(/0x1234.*abcdef/);
    expect(hashElement).toBeInTheDocument();
  });

  it('hides transaction hash when showHash is false', () => {
    render(<TransactionStatusTracker {...defaultProps} showHash={false} />);
    
    expect(screen.queryByText(/0x1234.*abcdef/)).not.toBeInTheDocument();
  });

  it('displays timestamp when showTimestamp is true', () => {
    render(<TransactionStatusTracker {...defaultProps} showTimestamp={true} />);
    
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });

  it('hides timestamp when showTimestamp is false', () => {
    render(<TransactionStatusTracker {...defaultProps} showTimestamp={false} />);
    
    expect(screen.queryByText('Last Updated')).not.toBeInTheDocument();
  });

  it('shows polling indicator when not using WebSocket', () => {
    render(<TransactionStatusTracker {...defaultProps} useWebSocket={false} />);
    
    expect(screen.getByText(/Polling every/)).toBeInTheDocument();
  });

  it('shows WebSocket indicator when using WebSocket', () => {
    render(<TransactionStatusTracker {...defaultProps} useWebSocket={true} websocketUrl="ws://localhost:8546" />);
    
    expect(screen.getByText('WebSocket connected')).toBeInTheDocument();
  });

  it('uses custom labels', () => {
    const customLabels = {
      pending: 'Custom Pending',
      confirmed: 'Custom Confirmed',
      failed: 'Custom Failed',
    };
    
    render(<TransactionStatusTracker {...defaultProps} labels={customLabels} />);
    
    expect(screen.getByText('Custom Pending')).toBeInTheDocument();
  });

  it('calls onSuccess callback when transaction is confirmed', async () => {
    const mockOnSuccess = jest.fn();
    
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 12345,
      gasUsed: { toString: () => '21000' },
      confirmations: 1,
    });

    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        onSuccess={mockOnSuccess}
        pollingInterval={100}
      />
    );

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(defaultProps.txHash);
    });
  });

  it('calls onError callback when transaction fails', async () => {
    const mockOnError = jest.fn();
    
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 0,
      blockNumber: 12345,
      gasUsed: { toString: () => '21000' },
      confirmations: 0,
    });

    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        onError={mockOnError}
        pollingInterval={100}
      />
    );

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it('calls onTimeout callback when transaction times out', async () => {
    const mockOnTimeout = jest.fn();
    
    mockProvider.getTransactionReceipt.mockResolvedValue(null);

    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        onTimeout={mockOnTimeout}
        timeout={100}
        pollingInterval={50}
      />
    );

    await waitFor(() => {
      expect(mockOnTimeout).toHaveBeenCalledWith(defaultProps.txHash);
    }, { timeout: 1000 });
  });

  it('displays error message when provider throws error', async () => {
    const errorMessage = 'Network error';
    mockProvider.getTransactionReceipt.mockRejectedValue(new Error(errorMessage));

    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        pollingInterval={100}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('shows explorer link when explorerUrl is provided', () => {
    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        explorerUrl="https://etherscan.io/tx"
      />
    );

    const explorerLink = screen.getByRole('link', { name: /View transaction/ });
    expect(explorerLink).toBeInTheDocument();
    expect(explorerLink).toHaveAttribute('href', expect.stringContaining('https://etherscan.io/tx'));
  });

  it('displays transaction details when confirmed', async () => {
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 12345,
      gasUsed: { toString: () => '21000' },
      confirmations: 5,
    });

    render(
      <TransactionStatusTracker 
        {...defaultProps} 
        pollingInterval={100}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // confirmations
      expect(screen.getByText('21,000')).toBeInTheDocument(); // gas used
      expect(screen.getByText('12345')).toBeInTheDocument(); // block number
    });
  });
});
