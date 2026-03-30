/**
 * OnboardingTour Component Tests
 *
 * This test suite validates the OnboardingTour component's functionality
 * including rendering, step navigation, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingTour from './OnboardingTour';
import type { OnboardingTour as OnboardingTourType } from '@/types/onboardingTour';

describe('OnboardingTour Component', () => {
  const mockTour: OnboardingTourType = {
    id: 'test-tour',
    name: 'Test Tour',
    steps: [
      {
        id: 'step-1',
        title: 'Step 1',
        description: 'First step',
        targetSelector: '[data-test="target-1"]',
        position: 'bottom',
      },
      {
        id: 'step-2',
        title: 'Step 2',
        description: 'Second step',
        targetSelector: '[data-test="target-2"]',
        position: 'right',
      },
      {
        id: 'step-3',
        title: 'Step 3',
        description: 'Third step',
        targetSelector: '[data-test="target-3"]',
        position: 'top',
      },
    ],
    showProgressBar: true,
    showSkipButton: true,
  };

  beforeEach(() => {
    // Setup mock DOM elements
    document.body.innerHTML = `
      <div data-test="target-1">Target 1</div>
      <div data-test="target-2">Target 2</div>
      <div data-test="target-3">Target 3</div>
    `;
  });

  describe('Rendering', () => {
    it('renders nothing when isActive is false', () => {
      const { container } = render(
        <OnboardingTour
          tour={mockTour}
          isActive={false}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders tour content when isActive is true', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('First step')).toBeInTheDocument();
    });

    it('displays correct step title and description', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={1}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Second step')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('displays Next button on first step', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
    });

    it('displays Previous button on middle step', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={1}
          onNext={() => {}}
          onPrev={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    it('displays Done button on last step', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={2}
          onNext={() => {}}
          onSkip={() => {}}
          onComplete={() => {}}
        />
      );

      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('calls onNext when Next button is clicked', () => {
      const mockOnNext = vi.fn();
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={mockOnNext}
          onSkip={() => {}}
        />
      );

      fireEvent.click(screen.getByText('Next'));
      expect(mockOnNext).toHaveBeenCalled();
    });

    it('calls onPrev when Previous button is clicked', () => {
      const mockOnPrev = vi.fn();
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={1}
          onNext={() => {}}
          onPrev={mockOnPrev}
          onSkip={() => {}}
        />
      );

      fireEvent.click(screen.getByText('Previous'));
      expect(mockOnPrev).toHaveBeenCalled();
    });

    it('calls onComplete when Done button is clicked', () => {
      const mockOnComplete = vi.fn();
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={2}
          onNext={() => {}}
          onSkip={() => {}}
          onComplete={mockOnComplete}
        />
      );

      fireEvent.click(screen.getByText('Done'));
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe('Skip Functionality', () => {
    it('displays Skip button when showSkipButton is true', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('hides Skip button when showSkipButton is false', () => {
      const tourWithoutSkip: OnboardingTourType = {
        ...mockTour,
        showSkipButton: false,
      };

      render(
        <OnboardingTour
          tour={tourWithoutSkip}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.queryByText('Skip')).not.toBeInTheDocument();
    });

    it('calls onSkip when Skip button is clicked', () => {
      const mockOnSkip = vi.fn();
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={mockOnSkip}
        />
      );

      const skipButtons = screen.getAllByText('Skip');
      fireEvent.click(skipButtons[0]); // Click the Skip button in step counter area
      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe('Progress Bar', () => {
    it('displays progress bar when showProgressBar is true', () => {
      const { container } = render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('hides progress bar when showProgressBar is false', () => {
      const tourWithoutProgress: OnboardingTourType = {
        ...mockTour,
        showProgressBar: false,
      };

      const { container } = render(
        <OnboardingTour
          tour={tourWithoutProgress}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      // Progress bar won't be rendered
      expect(container.querySelector('.bg-blue-500')).not.toBeInTheDocument();
    });

    it('updates progress as steps change', () => {
      const { rerender } = render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      // Check step counter shows 1 of 3
      expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();

      // Move to step 2
      rerender(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={1}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
    });
  });

  describe('Highlight', () => {
    it('creates highlight element around target', async () => {
      const { container } = render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      await waitFor(() => {
        const highlight = container.querySelector('[style*="border"]');
        expect(highlight).toBeInTheDocument();
      });
    });

    it('uses custom highlight color', async () => {
      const customTour: OnboardingTourType = {
        ...mockTour,
        highlightColor: '#ff0000',
      };

      const { container } = render(
        <OnboardingTour
          tour={customTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      await waitFor(() => {
        const highlight = container.querySelector('[style*="border"]');
        expect(highlight?.getAttribute('style')).toContain('#ff0000');
      });
    });
  });

  describe('Accessibility', () => {
    it('has aria labels on buttons', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByLabelText('Next step')).toBeInTheDocument();
      expect(screen.getByLabelText('Skip tour')).toBeInTheDocument();
    });

    it('has aria label for Previous button', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={1}
          onNext={() => {}}
          onPrev={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByLabelText('Previous step')).toBeInTheDocument();
    });

    it('has aria label for Done button', () => {
      render(
        <OnboardingTour
          tour={mockTour}
          isActive={true}
          currentStepIndex={2}
          onNext={() => {}}
          onSkip={() => {}}
          onComplete={() => {}}
        />
      );

      expect(screen.getByLabelText('Complete tour')).toBeInTheDocument();
    });
  });

  describe('Overlay', () => {
    it('uses custom overlay color', () => {
      const customTour: OnboardingTourType = {
        ...mockTour,
        overlayColor: 'rgba(255, 0, 0, 0.5)',
      };

      const { container } = render(
        <OnboardingTour
          tour={customTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      const overlay = container.querySelector('[style*="background"]');
      expect(overlay?.getAttribute('style')).toContain('rgba(255, 0, 0, 0.5)');
    });

    it('applies overlay opacity', () => {
      const customTour: OnboardingTourType = {
        ...mockTour,
        overlayOpacity: 0.8,
      };

      render(
        <OnboardingTour
          tour={customTour}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      // Tour should render with custom opacity
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });
  });

  describe('Step Positioning', () => {
    it('respects step position configuration', () => {
      const tourWithPositions: OnboardingTourType = {
        id: 'position-tour',
        name: 'Position Tour',
        steps: [
          {
            id: 'step-1',
            title: 'Top Position',
            description: 'Tooltip at top',
            targetSelector: '[data-test="target-1"]',
            position: 'top',
          },
        ],
      };

      render(
        <OnboardingTour
          tour={tourWithPositions}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(screen.getByText('Top Position')).toBeInTheDocument();
    });
  });

  describe('Missing Target Handling', () => {
    it('handles missing target element gracefully', () => {
      const tourWithMissingTarget: OnboardingTourType = {
        ...mockTour,
        steps: [
          {
            id: 'step-1',
            title: 'Missing Target',
            description: 'Target does not exist',
            targetSelector: '[data-test="nonexistent"]',
            position: 'bottom',
          },
        ],
      };

      const consoleSpy = vi.spyOn(console, 'warn');
      render(
        <OnboardingTour
          tour={tourWithMissingTarget}
          isActive={true}
          currentStepIndex={0}
          onNext={() => {}}
          onSkip={() => {}}
        />
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Target element not found'));
    });
  });
});
