import { render, screen, act } from '@testing-library/react';
import EventCapacityIndicator from './EventCapacityIndicator';

describe('EventCapacityIndicator', () => {
  it('renders capacity info correctly', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredCount={60} />);
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('/ 100 registered')).toBeInTheDocument();
  });

  it('shows Almost Full warning when 80% or more filled', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredCount={85} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Almost Full');
  });

  it('shows Event Full when capacity is reached', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredCount={100} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Event Full');
  });

  it('has correct progressbar aria attributes', () => {
    render(<EventCapacityIndicator totalCapacity={200} registeredCount={150} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
  });

  it('shows spots remaining when not full', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredCount={60} />);
    expect(screen.getByText('40 left')).toBeInTheDocument();
  });

  it('shows no warning badge when under 80%', () => {
    render(<EventCapacityIndicator totalCapacity={100} registeredCount={50} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
