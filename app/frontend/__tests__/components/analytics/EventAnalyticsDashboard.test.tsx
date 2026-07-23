import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EventAnalyticsDashboard } from '@/components/analytics/EventAnalyticsDashboard';

// Mock child component to isolate test scope
jest.mock('@/components/analytics/MetricCard', () => ({
  MetricCard: ({ data, isLoading }: { data?: any; isLoading?: boolean }) => (
    <div data-testid="metric-card">
      {isLoading ? 'Skeleton Loading...' : `${data?.title}: ${data?.value}`}
    </div>
  ),
}));

describe('EventAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock URL & anchor elements for CSV download testing
    window.URL.createObjectURL = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders loading skeletons on initial mount', () => {
    render(<EventAnalyticsDashboard />);

    // Should render 4 metric card skeletons initially
    const metricCards = screen.getAllByTestId('metric-card');
    expect(metricCards).toHaveLength(4);
    expect(metricCards[0]).toHaveTextContent('Skeleton Loading...');
  });

  it('renders dashboard metrics after data loads', async () => {
    render(<EventAnalyticsDashboard />);

    // Fast-forward past the simulated API latency delay (800ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Total Contract Events:/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Wallets:/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Gas Volume/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed Event Ratio:/i)).toBeInTheDocument();
    });
  });

  it('triggers manual refresh on refresh button click', async () => {
    render(<EventAnalyticsDashboard />);

    // Initial load
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Total Contract Events:/i)).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    
    // Click manual refresh
    fireEvent.click(refreshBtn);
    expect(screen.getByText(/Refreshing.../i)).toBeInTheDocument();

    // Fast-forward past refresh API delay
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Refreshing.../i)).not.toBeInTheDocument();
    });
  });

  it('handles auto-refresh based on interval dropdown selection', async () => {
    render(<EventAnalyticsDashboard />);

    // Fast-forward initial load
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Default interval is 10000ms (10s)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Verify refresh cycle executed
    expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
  });

  it('exports CSV on export button click', async () => {
    render(<EventAnalyticsDashboard />);

    // Wait for initial load
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).not.toBeDisabled();
    });

    // Mock DOM elements for download trigger
    const linkClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportBtn);

    expect(linkClickSpy).toHaveBeenCalledTimes(1);
    linkClickSpy.mockRestore();
  });
});