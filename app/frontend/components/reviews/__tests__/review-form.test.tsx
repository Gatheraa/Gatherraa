import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewForm from '../review-form';
import { reviewsApi } from '../../../lib/api/reviews';
import '@testing-library/jest-dom';

// Mock the API and FileUpload
jest.mock('../../../lib/api/reviews');
jest.mock('../file-upload', () => {
  return function MockFileUpload() {
    return <div data-testid="file-upload-mock" />;
  };
});

describe('ReviewForm Component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();
  const eventId = 'event-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ReviewForm eventId={eventId} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    expect(screen.getByText('Write a Review')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Give your review a title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Share your experience...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows error if submitted without a rating', async () => {
    render(<ReviewForm eventId={eventId} onSubmit={mockOnSubmit} />);
    
    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    expect(submitBtn).toBeDisabled();
    
    // We cannot click it when disabled, but if we somehow bypass it or use form submit:
    fireEvent.submit(submitBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/please select a star rating/i)).toBeInTheDocument();
    });
  });

  it('enables submit when rating is provided and shows validation errors on empty content', async () => {
    render(<ReviewForm eventId={eventId} onSubmit={mockOnSubmit} />);
    
    // Click 5th star
    const stars = screen.getAllByRole('button', { name: /star/i });
    fireEvent.click(stars[4]);

    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    expect(submitBtn).toBeEnabled();

    // Submit with empty content
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/review must be at least 10 characters/i)).toBeInTheDocument();
    });
  });

  it('submits successfully when form is valid', async () => {
    (reviewsApi.createReview as jest.Mock).mockResolvedValueOnce({ id: 'review-123' });
    
    render(<ReviewForm eventId={eventId} onSubmit={mockOnSubmit} />);
    
    // Select 4 stars
    const stars = screen.getAllByRole('button', { name: /star/i });
    fireEvent.click(stars[3]);

    // Enter title
    const titleInput = screen.getByPlaceholderText('Give your review a title');
    await userEvent.type(titleInput, 'Great event!');

    // Enter content
    const contentTextarea = screen.getByPlaceholderText('Share your experience...');
    await userEvent.type(contentTextarea, 'I really enjoyed the speakers and the overall vibe.');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(reviewsApi.createReview).toHaveBeenCalledWith(
        eventId,
        {
          rating: 4,
          title: 'Great event!',
          content: 'I really enjoyed the speakers and the overall vibe.',
        },
        []
      );
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('displays API error if submission fails', async () => {
    (reviewsApi.createReview as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    
    render(<ReviewForm eventId={eventId} onSubmit={mockOnSubmit} />);
    
    // Select 3 stars
    const stars = screen.getAllByRole('button', { name: /star/i });
    fireEvent.click(stars[2]);

    const contentTextarea = screen.getByPlaceholderText('Share your experience...');
    await userEvent.type(contentTextarea, 'It was okay but could be better.');

    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/failed to submit review/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
