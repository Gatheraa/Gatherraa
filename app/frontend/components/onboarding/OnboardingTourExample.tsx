'use client';

import React from 'react';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import OnboardingTour from './OnboardingTour';
import type { OnboardingTour as OnboardingTourType } from '@/types/onboardingTour';

/**
 * OnboardingTour Component Examples
 * Demonstrates various tour configurations
 */
export default function OnboardingTourExample() {
  // Example 1: Basic product tour
  const basicTour: OnboardingTourType = {
    id: 'product-tour',
    name: 'Product Tour',
    description: 'Introduction to core features',
    steps: [
      {
        id: 'step-1',
        title: 'Welcome to Our App',
        description: 'This is a guided tour of the main features. Click Next to continue.',
        targetSelector: '.hero-section',
        position: 'bottom',
      },
      {
        id: 'step-2',
        title: 'Navigation Menu',
        description: 'Use the menu to navigate between different sections of the app.',
        targetSelector: 'nav',
        position: 'right',
      },
      {
        id: 'step-3',
        title: 'Settings',
        description: 'Customize your preferences and account settings here.',
        targetSelector: '[data-tour="settings"]',
        position: 'left',
      },
    ],
    showProgressBar: true,
    showSkipButton: true,
    allowKeyboardNavigation: true,
    overlayOpacity: 0.7,
  };

  // Example 2: Feature announcement tour
  const featureTour: OnboardingTourType = {
    id: 'new-feature-tour',
    name: 'New Feature Tour',
    description: 'Learn about our latest features',
    steps: [
      {
        id: 'feature-1',
        title: 'New Dashboard',
        description: 'We redesigned the dashboard for better performance and usability.',
        targetSelector: '.dashboard-widget',
        position: 'bottom',
        highlightPadding: 10,
      },
      {
        id: 'feature-2',
        title: 'Quick Actions',
        description: 'Access frequently used actions from the quick action bar.',
        targetSelector: '[data-tour="quick-actions"]',
        position: 'bottom',
      },
      {
        id: 'feature-3',
        title: 'Dark Mode',
        description: 'We added dark mode support. Toggle it in settings.',
        targetSelector: '[data-tour="theme-toggle"]',
        position: 'left',
      },
    ],
    showProgressBar: true,
    highlightColor: '#8b5cf6',
  };

  // Example 3: Workflow tour
  const workflowTour: OnboardingTourType = {
    id: 'workflow-tour',
    name: 'Workflow Guide',
    description: 'Step-by-step guide for completing a workflow',
    steps: [
      {
        id: 'workflow-1',
        title: 'Step 1: Start Here',
        description: 'Click the button to begin the workflow.',
        targetSelector: '[data-tour="start-btn"]',
        position: 'bottom',
        allowClickOnTarget: true,
      },
      {
        id: 'workflow-2',
        title: 'Step 2: Fill Form',
        description: 'Enter the required information in this form.',
        targetSelector: 'form',
        position: 'right',
      },
      {
        id: 'workflow-3',
        title: 'Step 3: Review',
        description: 'Review your information before submitting.',
        targetSelector: '[data-tour="review-section"]',
        position: 'top',
      },
      {
        id: 'workflow-4',
        title: 'Step 4: Submit',
        description: 'Click submit to complete the workflow.',
        targetSelector: '[data-tour="submit-btn"]',
        position: 'bottom',
      },
    ],
    showProgressBar: true,
  };

  // Use hook for first tour
  const {
    isActive: isBasicActive,
    currentStepIndex: basicStepIndex,
    nextStep: basicNext,
    prevStep: basicPrev,
    skipTour: basicSkip,
    completeTour: basicComplete,
    isCompleted: basicCompleted,
  } = useOnboardingTour({
    tourId: basicTour.id,
    tour: basicTour,
    autoStart: false,
    persistState: true,
  });

  // Use hook for feature tour
  const {
    isActive: isFeatureActive,
    currentStepIndex: featureStepIndex,
    nextStep: featureNext,
    prevStep: featurePrev,
    skipTour: featureSkip,
    completeTour: featureComplete,
    isCompleted: featureCompleted,
  } = useOnboardingTour({
    tourId: featureTour.id,
    tour: featureTour,
    autoStart: false,
    persistState: true,
  });

  // Use hook for workflow tour
  const {
    isActive: isWorkflowActive,
    currentStepIndex: workflowStepIndex,
    nextStep: workflowNext,
    prevStep: workflowPrev,
    skipTour: workflowSkip,
    completeTour: workflowComplete,
    isCompleted: workflowCompleted,
  } = useOnboardingTour({
    tourId: workflowTour.id,
    tour: workflowTour,
    autoStart: false,
    persistState: true,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">OnboardingTour Component Examples</h1>

      {/* Example 1: Basic Tour */}
      <section className="p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Example 1: Basic Product Tour</h2>
            <p className="text-sm text-gray-600 mt-1">
              Interactive guided tour highlighting key application elements.
            </p>
          </div>
          <button
            onClick={() => {
              // Start tour logic
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {basicCompleted ? 'Restart Tour' : 'Start Tour'}
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <p>✓ Highlights key UI elements</p>
          <p>✓ Shows step-by-step guides with overlay</p>
          <p>✓ Progress bar shows completion</p>
          <p>✓ Skip option available</p>
        </div>

        <OnboardingTour
          tour={basicTour}
          isActive={isBasicActive}
          currentStepIndex={basicStepIndex}
          onNext={basicNext}
          onPrev={basicPrev}
          onSkip={basicSkip}
          onComplete={basicComplete}
        />
      </section>

      {/* Example 2: Feature Announcement Tour */}
      <section className="p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Example 2: Feature Announcement</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showcase new features to users with custom styling.
            </p>
          </div>
          <button
            onClick={() => {
              // Start tour logic
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {featureCompleted ? 'Restart Tour' : 'Learn What\'s New'}
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <p>✓ Highlights new features</p>
          <p>✓ Custom highlight color</p>
          <p>✓ Flexible positioning (top, bottom, left, right)</p>
          <p>✓ Persists completion state</p>
        </div>

        <OnboardingTour
          tour={featureTour}
          isActive={isFeatureActive}
          currentStepIndex={featureStepIndex}
          onNext={featureNext}
          onPrev={featurePrev}
          onSkip={featureSkip}
          onComplete={featureComplete}
        />
      </section>

      {/* Example 3: Workflow Tour */}
      <section className="p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Example 3: Workflow Guide</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step-by-step workflow guidance for completing tasks.
            </p>
          </div>
          <button
            onClick={() => {
              // Start tour logic
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {workflowCompleted ? 'Restart Workflow' : 'Start Workflow Guide'}
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <p>✓ Guides users through multi-step workflows</p>
          <p>✓ Can allow clicking on highlighted elements</p>
          <p>✓ Next/Previous navigation</p>
          <p>✓ Clear completion state</p>
        </div>

        <OnboardingTour
          tour={workflowTour}
          isActive={isWorkflowActive}
          currentStepIndex={workflowStepIndex}
          onNext={workflowNext}
          onPrev={workflowPrev}
          onSkip={workflowSkip}
          onComplete={workflowComplete}
        />
      </section>

      {/* Integration Guide */}
      <section className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Integration Steps</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Define tour steps with element selectors and descriptions</li>
          <li>Create OnboardingTour instance with steps array</li>
          <li>Use useOnboardingTour hook to manage tour state</li>
          <li>Render OnboardingTour component with hooks callbacks</li>
          <li>Trigger tour on component mount or user action</li>
          <li>Tour state persists to localStorage by default</li>
          <li>Customize colors, positioning, and behavior via tour config</li>
        </ol>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-2">Configuration Example</h3>
          <pre className="bg-white p-3 rounded text-xs overflow-x-auto text-gray-700">{`const tour: OnboardingTour = {
  id: 'my-tour',
  name: 'My Tour',
  steps: [
    {
      id: 'step-1',
      title: 'First Step',
      description: 'Description text',
      targetSelector: '.my-element',
      position: 'bottom',
      allowClickOnTarget: false,
    },
  ],
  showProgressBar: true,
  showSkipButton: true,
  overlayOpacity: 0.6,
  highlightColor: '#3b82f6',
};`}</pre>
        </div>
      </section>

      {/* Props Reference */}
      <section className="p-6 bg-gray-900 rounded-lg text-gray-100">
        <h2 className="text-lg font-semibold mb-3">OnboardingTour Props</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2">Prop</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Default</th>
              <th className="text-left py-2">Description</th>
            </tr>
          </thead>
          <tbody className="space-y-1">
            <tr className="border-b border-gray-700">
              <td className="py-2">tour</td>
              <td>OnboardingTour</td>
              <td>required</td>
              <td>Tour configuration with steps</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">isActive</td>
              <td>boolean</td>
              <td>false</td>
              <td>Show/hide the tour</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">currentStepIndex</td>
              <td>number</td>
              <td>0</td>
              <td>Current step index</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">onNext</td>
              <td>() =&gt; void</td>
              <td>undefined</td>
              <td>Next button callback</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">onPrev</td>
              <td>() =&gt; void</td>
              <td>undefined</td>
              <td>Previous button callback</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">onSkip</td>
              <td>() =&gt; void</td>
              <td>undefined</td>
              <td>Skip tour callback</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">onComplete</td>
              <td>() =&gt; void</td>
              <td>undefined</td>
              <td>Completion callback</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
