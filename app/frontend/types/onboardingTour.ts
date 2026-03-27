/**
 * Onboarding Tour Type Definitions
 */

/**
 * Individual tour step configuration
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Default: 'bottom'
  highlightPadding?: number; // Padding around highlighted element (default: 8)
  delay?: number; // Delay before showing step in ms (default: 0)
  allowClickOnTarget?: boolean; // Allow clicking target element (default: false)
  offsetX?: number; // Horizontal offset for tooltip (default: 0)
  offsetY?: number; // Vertical offset for tooltip (default: 0)
}

/**
 * Complete tour configuration
 */
export interface OnboardingTour {
  id: string;
  name: string;
  description?: string;
  steps: OnboardingStep[];
  showProgressBar?: boolean;
  showSkipButton?: boolean;
  showDoneButton?: boolean;
  allowKeyboardNavigation?: boolean;
  closeOnEsc?: boolean;
  overlayOpacity?: number; // 0-1, default: 0.6
  overlayColor?: string; // default: 'rgba(0, 0, 0, 0.6)'
  highlightColor?: string; // Border color for highlight, default: '#3b82f6'
}

/**
 * Tour state maintained by hook
 */
export interface OnboardingTourState {
  currentStep: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
  skippedAt?: string;
}

/**
 * Hook options
 */
export interface UseOnboardingTourOptions {
  tourId: string;
  tour: OnboardingTour;
  autoStart?: boolean; // Auto-start if not completed
  persistState?: boolean; // Persist to localStorage
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number) => void;
}

/**
 * Hook return value
 */
export interface UseOnboardingTourReturn {
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  totalSteps: number;
  progress: number; // 0-100
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  goToStep: (index: number) => void;
}

/**
 * Component props
 */
export interface OnboardingTourProps {
  tour: OnboardingTour;
  isActive?: boolean;
  currentStepIndex?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  className?: string;
  tooltipClassName?: string;
}

/**
 * Highlight overlay styles
 */
export interface HighlightStyles {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
}

/**
 * Tooltip position info
 */
export interface TooltipPosition {
  top: number;
  left: number;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Tutorial tour types
 */
export type TourType = 'onboarding' | 'feature' | 'workflow';

/**
 * User tour progress tracking
 */
export interface UserTourProgress {
  userId: string;
  tourId: string;
  completedSteps: string[];
  totalSteps: number;
  progress: number;
  isCompleted: boolean;
  completedAt?: string;
  skippedAt?: string;
  lastViewedStep?: number;
}
