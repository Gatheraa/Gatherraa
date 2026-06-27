import React from 'react';
import { render, screen } from '@testing-library/react';
import AttendanceAnalyticsWidget from '../AttendanceAnalyticsWidget';
import { Event } from '../../../../lib/api/events';
import '@testing-library/jest-dom';

// Mock Recharts to avoid issues with rendering SVG charts in Jest
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('AttendanceAnalyticsWidget', () => {
  const createMockEvent = (registered: number, attendance: number): Event => ({
    id: '1',
    title: 'Test Event',
    type: 'conference',
    category: 'tech',
    startDate: '2026-06-20T10:00:00Z',
    location: 'Virtual',
    organizerId: 'org1',
    organizerName: 'Org',
    capacity: 100,
    isFeatured: false,
    registeredCount: registered,
    attendanceCount: attendance,
    status: 'published',
    isPublic: true,
    isDeleted: false,
    version: 1,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  });

  it('renders correctly with attendance data', () => {
    const event = createMockEvent(100, 75);
    render(<AttendanceAnalyticsWidget event={event} />);

    expect(screen.getByText('Attendance Analytics')).toBeInTheDocument();
    
    // Check metric labels
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('Checked-in')).toBeInTheDocument();
    expect(screen.getByText('Attendance Rate')).toBeInTheDocument();

    // Check values
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    // Check chart
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('handles edge case when there are zero registrations', () => {
    const event = createMockEvent(0, 0);
    render(<AttendanceAnalyticsWidget event={event} />);

    // Values should be 0
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument();

    // Should show no data placeholder instead of chart
    expect(screen.getByText('No registration data available yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });

  it('handles attendance higher than registered (edge case)', () => {
    const event = createMockEvent(50, 60);
    render(<AttendanceAnalyticsWidget event={event} />);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });
});
