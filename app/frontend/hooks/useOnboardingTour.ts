'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  OnboardingTour,
  OnboardingStep,
  UseOnboardingTourOptions,
  UseOnboardingTourReturn,
  OnboardingTourState,
} from '@/types/onboardingTour';

const STORAGE_PREFIX = 'onboarding_tour_';

/**
 * Custom hook for managing onboarding tour state
 * Handles step navigation, completion tracking, and persistence
 */
export function useOnboardingTour(options: UseOnboardingTourOptions): UseOnboardingTourReturn {
  const {
    tourId,
    tour,
    autoStart = false,
    persistState = true,
    onComplete,
    onSkip,
    onStepChange,
  } = options;

  const storageKey = `${STORAGE_PREFIX}${tourId}`;

  // Initialize state from localStorage or defaults
  const [state, setState] = useState<OnboardingTourState>(() => {
    if (persistState && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    }

    return {
      currentStep: 0,
      isActive: autoStart,
      isCompleted: false,
    };
  });

  // Save state to localStorage
  useEffect(() => {
    if (persistState && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, persistState, storageKey]);

  // Get current step object
  const currentStep: OnboardingStep | null =
    state.currentStep >= 0 && state.currentStep < tour.steps.length
      ? tour.steps[state.currentStep]
      : null;

  const totalSteps = tour.steps.length;
  const progress = totalSteps > 0 ? ((state.currentStep + 1) / totalSteps) * 100 : 0;

  // Navigate to next step
  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentStep + 1;

      if (nextIndex >= totalSteps) {
        // Tour complete
        const newState: OnboardingTourState = {
          ...prev,
          isActive: false,
          isCompleted: true,
          completedAt: new Date().toISOString(),
        };
        setTimeout(() => onComplete?.(), 0);
        return newState;
      }

      const newState: OnboardingTourState = {
        ...prev,
        currentStep: nextIndex,
      };
      setTimeout(() => onStepChange?.(nextIndex), 0);
      return newState;
    });
  }, [totalSteps, onComplete, onStepChange]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 0) return prev;

      const newIndex = prev.currentStep - 1;
      const newState: OnboardingTourState = {
        ...prev,
        currentStep: newIndex,
      };
      setTimeout(() => onStepChange?.(newIndex), 0);
      return newState;
    });
  }, [onStepChange]);

  // Skip the entire tour
  const skipTour = useCallback(() => {
    setState((prev) => {
      const newState: OnboardingTourState = {
        ...prev,
        isActive: false,
        skippedAt: new Date().toISOString(),
      };
      setTimeout(() => onSkip?.(), 0);
      return newState;
    });
  }, [onSkip]);

  // Mark tour as completed
  const completeTour = useCallback(() => {
    setState((prev) => {
      const newState: OnboardingTourState = {
        ...prev,
        isActive: false,
        isCompleted: true,
        completedAt: new Date().toISOString(),
      };
      setTimeout(() => onComplete?.(), 0);
      return newState;
    });
  }, [onComplete]);

  // Reset tour to first step
  const resetTour = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: 0,
      isActive: true,
      isCompleted: false,
      completedAt: undefined,
      skippedAt: undefined,
    }));
  }, []);

  // Go to specific step
  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setState((prev) => {
          const newState: OnboardingTourState = {
            ...prev,
            currentStep: index,
          };
          setTimeout(() => onStepChange?.(index), 0);
          return newState;
        });
      }
    },
    [totalSteps, onStepChange]
  );

  return {
    currentStep,
    currentStepIndex: state.currentStep,
    isActive: state.isActive,
    isCompleted: state.isCompleted,
    totalSteps,
    progress,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
    goToStep,
  };
}
