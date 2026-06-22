import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCapacityIndicator } from '@/components/events/EventCapacityIndicator';

describe('EventCapacityIndicator', () => {
  it('renders with basic props', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={50} />);
    expect(screen.getByText('Event Capacity')).toBeInTheDocument();
    expect(screen.getByText('50 / 100')).toBeInTheDocument();
  });

  it('shows available status when under 80%', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={50} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('shows almost full warning at 80%+ capacity', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={85} />);
    expect(screen.getByText('Almost Full')).toBeInTheDocument();
  });

  it('shows sold out when at capacity', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={100} />);
    expect(screen.getByText('Sold Out')).toBeInTheDocument();
  });

  it('shows live indicator when isLive is true', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={50} isLive />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('displays spots left correctly', () => {
    render(<EventCapacityIndicator totalCapacity={200} registeredUsers={75} />);
    expect(screen.getByText('125 spots left')).toBeInTheDocument();
  });

  it('shows no spots remaining when sold out', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredUsers={100} />);
    expect(screen.getByText('No spots remaining')).toBeInTheDocument();
  });

  it('displays percentage full', () => {
    render(<EventCapacityIndicator totalCapacity={200} registeredUsers={50} />);
    expect(screen.getByText('25.0% full')).toBeInTheDocument();
  });
});
