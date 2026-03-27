'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, X, SkipForward } from 'lucide-react';
import type { OnboardingTourProps, HighlightStyles, TooltipPosition } from '@/types/onboardingTour';

const OnboardingTour: React.FC<OnboardingTourProps> = ({
  tour,
  isActive = false,
  currentStepIndex = 0,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  className = '',
  tooltipClassName = '',
}) => {
  const [highlightStyles, setHighlightStyles] = useState<HighlightStyles | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  const currentStep = tour.steps[currentStepIndex];
  const isLastStep = currentStepIndex === tour.steps.length - 1;
  const overlayOpacity = tour.overlayOpacity ?? 0.6;
  const overlayColor = tour.overlayColor ?? `rgba(0, 0, 0, ${overlayOpacity})`;
  const highlightColor = tour.highlightColor ?? '#3b82f6';

  // Calculate highlight position
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const calculatePosition = () => {
      const element = document.querySelector(currentStep.targetSelector);
      if (!element) {
        console.warn(`Target element not found: ${currentStep.targetSelector}`);
        return;
      }

      const rect = element.getBoundingClientRect();
      const padding = currentStep.highlightPadding ?? 8;

      setHighlightStyles({
        top: rect.top - padding + window.scrollY,
        left: rect.left - padding + window.scrollX,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: window.getComputedStyle(element).borderRadius,
      });

      // Calculate tooltip position
      calculateTooltipPosition(rect);
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [isActive, currentStep]);

  const calculateTooltipPosition = (elementRect: DOMRect) => {
    const tooltip = document.querySelector('[data-onboarding-tooltip]');
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 16;
    const position = currentStep?.position ?? 'bottom';
    const offsetX = currentStep?.offsetX ?? 0;
    const offsetY = currentStep?.offsetY ?? 0;

    let top: number;
    let left: number;

    switch (position) {
      case 'top':
        top = elementRect.top - tooltipRect.height - padding + window.scrollY + offsetY;
        left = elementRect.left + elementRect.width / 2 - tooltipRect.width / 2 + window.scrollX + offsetX;
        break;
      case 'bottom':
        top = elementRect.bottom + padding + window.scrollY + offsetY;
        left = elementRect.left + elementRect.width / 2 - tooltipRect.width / 2 + window.scrollX + offsetX;
        break;
      case 'left':
        top = elementRect.top + elementRect.height / 2 - tooltipRect.height / 2 + window.scrollY + offsetY;
        left = elementRect.left - tooltipRect.width - padding + window.scrollX + offsetX;
        break;
      case 'right':
        top = elementRect.top + elementRect.height / 2 - tooltipRect.height / 2 + window.scrollY + offsetY;
        left = elementRect.right + padding + window.scrollX + offsetX;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2 + window.scrollY + offsetY;
        left = window.innerWidth / 2 - tooltipRect.width / 2 + window.scrollX + offsetX;
        break;
      default:
        top = elementRect.bottom + padding + window.scrollY + offsetY;
        left = elementRect.left + elementRect.width / 2 - tooltipRect.width / 2 + window.scrollX + offsetX;
    }

    setTooltipPosition({ top, left, position });
  };

  if (!isActive || !currentStep) return null;

  const progressPercentage = ((currentStepIndex + 1) / tour.steps.length) * 100;

  return (
    <div className={`fixed inset-0 z-50 pointer-events-none ${className}`}>
      {/* Overlay */}
      <div
        className="fixed inset-0 pointer-events-auto"
        style={{ backgroundColor: overlayColor }}
        onClick={() => {
          if (currentStep.allowClickOnTarget === false) {
            onSkip?.();
          }
        }}
      />

      {/* Highlight Box */}
      {highlightStyles && (
        <div
          className="fixed pointer-events-auto"
          style={{
            top: highlightStyles.top,
            left: highlightStyles.left,
            width: highlightStyles.width,
            height: highlightStyles.height,
            border: `2px solid ${highlightColor}`,
            borderRadius: highlightStyles.borderRadius,
            boxShadow: '0 0 0 9999px ' + overlayColor,
            transition: 'all 0.3s ease',
          }}
          onClick={(e) => {
            if (currentStep.allowClickOnTarget) {
              const element = document.querySelector(currentStep.targetSelector);
              if (element) {
                (element as HTMLElement).click();
              }
            }
            e.stopPropagation();
          }}
        />
      )}

      {/* Tooltip */}
      {tooltipPosition && (
        <div
          data-onboarding-tooltip
          className={`fixed bg-white rounded-lg shadow-2xl p-6 max-w-sm pointer-events-auto z-50 ${tooltipClassName}`}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{currentStep.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{currentStep.description}</p>
            </div>
            <button
              onClick={onSkip}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Skip tour"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar */}
          {tour.showProgressBar !== false && (
            <div className="mb-4 bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}

          {/* Step Counter */}
          <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
            <span>
              Step {currentStepIndex + 1} of {tour.steps.length}
            </span>
            {tour.showSkipButton !== false && (
              <button onClick={onSkip} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <SkipForward size={14} />
                Skip
              </button>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentStepIndex > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft size={18} />
                Previous
              </button>
            )}

            {!isLastStep ? (
              <button
                onClick={onNext}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-auto"
                aria-label="Next step"
              >
                Next
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-auto"
                aria-label="Complete tour"
              >
                Done
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* Tooltip Arrow - Optional visual indicator */}
          <div
            className="absolute w-3 h-3 bg-white transform rotate-45"
            style={{
              [tooltipPosition.position === 'top'
                ? 'bottom'
                : tooltipPosition.position === 'bottom'
                  ? 'top'
                  : tooltipPosition.position === 'left'
                    ? 'right'
                    : 'left']: '-6px',
              left:
                tooltipPosition.position === 'left' || tooltipPosition.position === 'right'
                  ? 'auto'
                  : '50%',
              transform: tooltipPosition.position === 'left' || tooltipPosition.position === 'right' ? 'none' : 'translateX(-50%) rotate(45deg)',
              boxShadow:
                tooltipPosition.position === 'bottom'
                  ? '-1px -1px 1px rgba(0,0,0,0.1)'
                  : '1px 1px 1px rgba(0,0,0,0.1)',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default OnboardingTour;
