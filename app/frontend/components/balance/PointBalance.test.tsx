/**
 * PointBalance Component Tests
 * 
 * This test suite validates the PointBalance component's functionality
 * including rendering, state management, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PointBalance from './PointBalance';
import type { PointBalance as PointBalanceType } from '@/types/pointBalance';

describe('PointBalance Component', () => {
  const mockBalance: PointBalanceType = {
    id: 'balance-1',
    userId: 'user-123',
    totalBalance: 5250.75,
    availableBalance: 5000.00,
    lockedBalance: 200.00,
    pendingBalance: 50.75,
    currency: 'PTS',
    decimals: 2,
    lastUpdated: new Date(),
    percentageChange: 5.2,
  };

  describe('Compact Variant', () => {
    it('renders balance correctly in compact mode', () => {
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          currency="PTS"
        />
      );

      expect(screen.getByText(/5,250\.75/)).toBeInTheDocument();
      expect(screen.getByText('PTS')).toBeInTheDocument();
    });

    it('formats numbers with correct decimal places', () => {
      render(
        <PointBalance
          balance={1234.567}
          variant="compact"
          decimals={3}
        />
      );

      expect(screen.getByText(/1,234\.567/)).toBeInTheDocument();
    });

    it('shows percentage change indicator', () => {
      render(
        <PointBalance
          fullBalance={mockBalance}
          variant="compact"
        />
      );

      expect(screen.getByText('5.2%')).toBeInTheDocument();
    });

    it('displays correct color for positive trend', () => {
      const { container } = render(
        <PointBalance
          fullBalance={mockBalance}
          variant="compact"
        />
      );

      const percentageSpan = screen.getByText('5.2%').parentElement;
      expect(percentageSpan).toHaveClass('text-green-600');
    });

    it('displays correct color for negative trend', () => {
      const { container } = render(
        <PointBalance
          fullBalance={{ ...mockBalance, percentageChange: -3.5 }}
          variant="compact"
        />
      );

      const percentageSpan = screen.getByText('3.5%').parentElement;
      expect(percentageSpan).toHaveClass('text-red-600');
    });
  });

  describe('Detailed Variant', () => {
    it('renders balance breakdown in detailed mode', () => {
      render(
        <PointBalance
          fullBalance={mockBalance}
          variant="detailed"
        />
      );

      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Locked')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows breakdown only when toggled', () => {
      render(
        <PointBalance
          fullBalance={mockBalance}
          variant="detailed"
        />
      );

      const toggleButton = screen.getByText(/Balance Breakdown/);
      expect(toggleButton.textContent).toContain('▶');

      fireEvent.click(toggleButton);
      expect(toggleButton.textContent).toContain('▼');
    });

    it('hides zero values in breakdown', () => {
      const noLockedBalance = { ...mockBalance, lockedBalance: 0, pendingBalance: 0 };
      render(
        <PointBalance
          fullBalance={noLockedBalance}
          variant="detailed"
        />
      );

      const toggleButton = screen.getByText(/Balance Breakdown/);
      fireEvent.click(toggleButton);

      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    it('displays last updated timestamp', () => {
      render(
        <PointBalance
          fullBalance={mockBalance}
          variant="detailed"
        />
      );

      expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(
        <PointBalance
          isLoading={true}
          variant="compact"
        />
      );

      const skeleton = screen.getByText(/.*/).parentElement;
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is set', () => {
      render(
        <PointBalance
          error="Failed to fetch balance"
          variant="compact"
        />
      );

      expect(screen.getByText('Failed to fetch balance')).toBeInTheDocument();
    });

    it('shows retry button when onRefresh is provided', () => {
      render(
        <PointBalance
          error="Failed to fetch balance"
          variant="compact"
          onRefresh={() => console.log('Retry')}
        />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });

    it('calls onRefresh when retry button is clicked', () => {
      const mockRefresh = vi.fn();
      render(
        <PointBalance
          error="Failed to fetch balance"
          variant="compact"
          onRefresh={mockRefresh}
        />
      );

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip on hover', async () => {
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          tooltip="Your balance information"
        />
      );

      const tooltipButton = screen.getByLabelText('Balance information');
      fireEvent.mouseEnter(tooltipButton);

      await waitFor(() => {
        expect(screen.getByText('Your balance information')).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse leave', async () => {
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          tooltip="Your balance information"
        />
      );

      const tooltipButton = screen.getByLabelText('Balance information');
      fireEvent.mouseEnter(tooltipButton);
      fireEvent.mouseLeave(tooltipButton);

      await waitFor(() => {
        expect(screen.queryByText('Your balance information')).not.toBeInTheDocument();
      });
    });

    it('shows default tooltip when none provided', () => {
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
        />
      );

      const tooltipButton = screen.getByLabelText('Balance information');
      fireEvent.mouseEnter(tooltipButton);

      expect(screen.getByText(/Balance as of/)).toBeInTheDocument();
    });
  });

  describe('Refresh Button', () => {
    it('shows refresh button when onRefresh is provided', () => {
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          onRefresh={() => console.log('Refresh')}
        />
      );

      expect(screen.getByLabelText('Refresh balance')).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', () => {
      const mockRefresh = vi.fn();
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          onRefresh={mockRefresh}
        />
      );

      fireEvent.click(screen.getByLabelText('Refresh balance'));
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('disables refresh button while loading', () => {
      const mockRefresh = vi.fn();
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          isLoading={true}
          onRefresh={mockRefresh}
        />
      );

      const refreshButton = screen.getByLabelText('Refresh balance');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Empty State', () => {
    it('shows message when no balance is provided', () => {
      render(
        <PointBalance
          balance={null}
          variant="compact"
        />
      );

      expect(screen.getByText('No balance data available')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria labels on interactive elements', () => {
      render(
        <PointBalance
          fullBalance={mockBalance}
          variant="compact"
          onRefresh={() => console.log('Refresh')}
        />
      );

      expect(screen.getByLabelText('Balance information')).toBeInTheDocument();
      expect(screen.getByLabelText('Refresh balance')).toBeInTheDocument();
    });

    it('is keyboard accessible', () => {
      const mockRefresh = vi.fn();
      render(
        <PointBalance
          balance={5250.75}
          variant="compact"
          onRefresh={mockRefresh}
        />
      );

      const refreshButton = screen.getByLabelText('Refresh balance');
      refreshButton.focus();

      expect(refreshButton).toHaveFocus();
    });
  });
});

// To run tests:
// 1. Install: npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom vitest
// 2. Change describe.skip to describe above
// 3. Uncomment the commented test cases
// 4. Run: npm test
