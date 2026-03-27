import type { Meta, StoryObj } from '@storybook/react';
import OnboardingTour from './OnboardingTour';
import type { OnboardingTour as OnboardingTourType } from '@/types/onboardingTour';

const meta = {
  title: 'Components/OnboardingTour',
  component: OnboardingTour,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive guided tour component for onboarding new users',
      },
    },
  },
  tags: ['autodocs'],
} as Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock tour configuration
const basicTour: OnboardingTourType = {
  id: 'basic-tour',
  name: 'Basic Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Welcome to the App',
      description: 'This is the first step of the tutorial. Click Next to continue.',
      targetSelector: '[data-story="hero"]',
      position: 'bottom',
    },
    {
      id: 'step-2',
      title: 'Feature Navigation',
      description: 'Use these controls to navigate between different sections.',
      targetSelector: '[data-story="nav"]',
      position: 'right',
    },
    {
      id: 'step-3',
      title: 'Complete Your Journey',
      description: 'You are almost done with the tour!',
      targetSelector: '[data-story="footer"]',
      position: 'top',
    },
  ],
  showProgressBar: true,
  showSkipButton: true,
};

const customColorTour: OnboardingTourType = {
  id: 'custom-tour',
  name: 'Custom Color Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Custom Highlight',
      description: 'This tour uses custom colors and styling.',
      targetSelector: '[data-story="hero"]',
      position: 'bottom',
    },
  ],
  highlightColor: '#8b5cf6',
  overlayColor: 'rgba(139, 92, 246, 0.4)',
  showProgressBar: true,
};

const multiStepTour: OnboardingTourType = {
  id: 'multi-step',
  name: 'Multi-Step Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Step 1: Introduction',
      description: 'Welcome to our application walkthrough.',
      targetSelector: '[data-story="hero"]',
      position: 'bottom',
    },
    {
      id: 'step-2',
      title: 'Step 2: Navigation',
      description: 'Learn how to navigate the application.',
      targetSelector: '[data-story="nav"]',
      position: 'right',
    },
    {
      id: 'step-3',
      title: 'Step 3: Features',
      description: 'Discover the main features available.',
      targetSelector: '[data-story="feature"]',
      position: 'left',
    },
    {
      id: 'step-4',
      title: 'Step 4: Settings',
      description: 'Customize your experience in settings.',
      targetSelector: '[data-story="settings"]',
      position: 'top',
    },
    {
      id: 'step-5',
      title: 'Complete!',
      description: 'You have completed the tour. Happy exploring!',
      targetSelector: '[data-story="footer"]',
      position: 'top',
    },
  ],
  showProgressBar: true,
  showSkipButton: true,
};

const HighlightTour: OnboardingTourType = {
  id: 'highlight-tour',
  name: 'Highlight Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Important Element',
      description: 'This element is highlighted with extra padding for emphasis.',
      targetSelector: '[data-story="hero"]',
      position: 'bottom',
      highlightPadding: 16,
    },
  ],
  highlightColor: '#f59e0b',
  showProgressBar: true,
};

const PositionTour: OnboardingTourType = {
  id: 'position-tour',
  name: 'Position Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Bottom Position',
      description: 'Tooltip positioned below the element.',
      targetSelector: '[data-story="hero"]',
      position: 'bottom',
    },
  ],
  showProgressBar: true,
};

const CenterPositionTour: OnboardingTourType = {
  id: 'center-tour',
  name: 'Center Position Tour',
  steps: [
    {
      id: 'step-1',
      title: 'Center Modal',
      description: 'Tooltip positioned in the center of the screen.',
      targetSelector: '[data-story="hero"]',
      position: 'center',
    },
  ],
};

// Background wrapper component to add demo elements
const TourWrapper = ({ children, tour, stepIndex = 0 }: any) => (
  <div className="relative w-full min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div data-story="hero" className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Our Application</h1>
        <p className="text-gray-600">This is a guided tour demonstrating the onboarding flow.</p>
      </div>

      {/* Navigation */}
      <nav data-story="nav" className="bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">Dashboard</button>
          <button className="px-4 py-2 text-gray-700">Features</button>
          <button className="px-4 py-2 text-gray-700">Settings</button>
        </div>
      </nav>

      {/* Feature Section */}
      <div data-story="feature" className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Key Features</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-600">
          <li>Real-time collaboration</li>
          <li>Advanced analytics</li>
          <li>Customizable workflows</li>
        </ul>
      </div>

      {/* Settings Section */}
      <div data-story="settings" className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-gray-700">Dark Mode</label>
            <input type="checkbox" className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-gray-700">Notifications</label>
            <input type="checkbox" defaultChecked className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer data-story="footer" className="bg-white rounded-lg shadow-md p-6 text-center text-gray-600">
        <p>&copy; 2024 Our Application. All rights reserved.</p>
      </footer>
    </div>

    {/* Tour Component */}
    {children}
  </div>
);

/**
 * Stories
 */

export const BasicTour: Story = {
  render: () => (
    <TourWrapper tour={basicTour}>
      <OnboardingTour
        tour={basicTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const SecondStep: Story = {
  render: () => (
    <TourWrapper tour={basicTour} stepIndex={1}>
      <OnboardingTour
        tour={basicTour}
        isActive={true}
        currentStepIndex={1}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const LastStep: Story = {
  render: () => (
    <TourWrapper tour={basicTour} stepIndex={2}>
      <OnboardingTour
        tour={basicTour}
        isActive={true}
        currentStepIndex={2}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const CustomColors: Story = {
  render: () => (
    <TourWrapper tour={customColorTour}>
      <OnboardingTour
        tour={customColorTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const MultiStep: Story = {
  render: () => (
    <TourWrapper tour={multiStepTour} stepIndex={0}>
      <OnboardingTour
        tour={multiStepTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const MultiStepSecond: Story = {
  render: () => (
    <TourWrapper tour={multiStepTour} stepIndex={1}>
      <OnboardingTour
        tour={multiStepTour}
        isActive={true}
        currentStepIndex={1}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const MultiStepThird: Story = {
  render: () => (
    <TourWrapper tour={multiStepTour} stepIndex={2}>
      <OnboardingTour
        tour={multiStepTour}
        isActive={true}
        currentStepIndex={2}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const HighlightedElement: Story = {
  render: () => (
    <TourWrapper tour={HighlightTour}>
      <OnboardingTour
        tour={HighlightTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const BottomPosition: Story = {
  render: () => (
    <TourWrapper tour={PositionTour}>
      <OnboardingTour
        tour={PositionTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const CenterPosition: Story = {
  render: () => (
    <TourWrapper tour={CenterPositionTour}>
      <OnboardingTour
        tour={CenterPositionTour}
        isActive={true}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};

export const Inactive: Story = {
  render: () => (
    <TourWrapper tour={basicTour}>
      <OnboardingTour
        tour={basicTour}
        isActive={false}
        currentStepIndex={0}
        onNext={() => console.log('Next')}
        onPrev={() => console.log('Prev')}
        onSkip={() => console.log('Skip')}
        onComplete={() => console.log('Complete')}
      />
    </TourWrapper>
  ),
};
