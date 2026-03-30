import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ScrollHeader } from './ScrollHeader';

function ScrollDemoBody() {
  return (
    <div className="space-y-4 text-gray-600 dark:text-gray-400">
      <p className="text-sm">
        Scroll the page — the header compacts, gains blur, and shows the title.
      </p>
      {Array.from({ length: 12 }).map((_, i) => (
        <p key={i} className="leading-relaxed">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua.
        </p>
      ))}
    </div>
  );
}

const meta = {
  title: 'Layout/ScrollHeader',
  component: ScrollHeader,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[120vh] bg-gray-50 dark:bg-gray-900">
        <Story />
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
          <ScrollDemoBody />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ScrollHeader>;

export default meta;

type Story = StoryObj<typeof ScrollHeader>;

export const EventStyle: Story = {
  render: () => (
    <ScrollHeader threshold={24}>
      {({ compact }) => (
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="#"
            className="inline-flex shrink-0 items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            onClick={(e) => e.preventDefault()}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className={compact ? 'hidden sm:inline' : ''}>Back</span>
          </Link>
          <p
            className={`min-w-0 truncate font-semibold text-gray-900 transition-all duration-300 dark:text-white motion-reduce:transition-none ${
              compact ? 'max-w-[min(70vw,24rem)] text-base opacity-100' : 'max-w-0 overflow-hidden text-base opacity-0'
            }`}
            aria-hidden={!compact}
          >
            Community Summit 2026
          </p>
        </div>
      )}
    </ScrollHeader>
  ),
};

function InnerScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <ScrollHeader threshold={12} scrollContainerRef={ref}>
        {({ compact }) => (
          <div className="flex items-center gap-2 px-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {compact ? 'Compact' : 'Expanded'}
            </span>
          </div>
        )}
      </ScrollHeader>
      <div className="p-4 space-y-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i} className="text-sm text-gray-600 dark:text-gray-400">
            Line {i + 1} — scroll inside this box.
          </p>
        ))}
      </div>
    </div>
  );
}

export const CustomScrollContainer: Story = {
  render: () => (
    <div className="mx-auto max-w-md p-4">
      <p className="mb-2 text-xs text-gray-500">Scroll inside the bordered region.</p>
      <InnerScrollStory />
    </div>
  ),
  decorators: [(Story) => <div className="min-h-screen bg-gray-100 p-4 dark:bg-gray-950"><Story /></div>],
};
