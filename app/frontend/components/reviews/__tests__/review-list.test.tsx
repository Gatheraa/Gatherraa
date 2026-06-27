import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReviewList from '../review-list';
import { reviewsApi } from '../../../lib/api/reviews';
import '@testing-library/jest-dom';

jest.mock('../../../lib/api/reviews');
jest.mock('../review-card', () => {
  return function MockReviewCard({ review }: any) {
    return <div data-testid="review-card">{review.content}</div>;
  };
});

describe('ReviewList Component', () => {
  const mockReviews = {
    data: [
      { id: '1', rating: 5, content: 'Amazing experience!' },
      { id: '2', rating: 4, content: 'Very good event.' },
    ],
    total: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (reviewsApi.getAllReviews as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<ReviewList />);
    expect(screen.getByText(/loading reviews/i)).toBeInTheDocument();
  });

  it('renders reviews correctly after loading', async () => {
    (reviewsApi.getAllReviews as jest.Mock).mockResolvedValueOnce(mockReviews);
    
    render(<ReviewList />);
    
    await waitFor(() => {
      expect(screen.getAllByTestId('review-card')).toHaveLength(2);
      expect(screen.getByText('Amazing experience!')).toBeInTheDocument();
      expect(screen.getByText('Showing 2 of 2 reviews')).toBeInTheDocument();
    });
  });

  it('renders error state on API failure', async () => {
    (reviewsApi.getAllReviews as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));
    
    render(<ReviewList />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('calls correct API when eventId is provided', async () => {
    (reviewsApi.getReviews as jest.Mock).mockResolvedValueOnce(mockReviews);
    
    render(<ReviewList eventId="event-456" />);
    
    await waitFor(() => {
      expect(reviewsApi.getReviews).toHaveBeenCalledWith('event-456', expect.any(Object));
      expect(screen.getAllByTestId('review-card')).toHaveLength(2);
    });
  });
});
