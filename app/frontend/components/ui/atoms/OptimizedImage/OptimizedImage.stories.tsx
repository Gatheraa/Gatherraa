import type { Meta, StoryObj } from '@storybook/react';
import { OptimizedImage } from './OptimizedImage';

const meta = {
  title: 'Atoms/OptimizedImage',
  component: OptimizedImage,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OptimizedImage>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Random landscape image',
    width: 400,
    height: 300,
  },
};

export const WithAspectRatio: Story = {
  args: {
    src: 'https://picsum.photos/800/450',
    alt: '16:9 aspect ratio image',
    aspectRatio: '16/9',
    className: 'w-full max-w-md',
  },
};

export const WithPlaceholder: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Image with blur-up placeholder',
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCA0MCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNUMyNS41MjI4IDE1IDMwIDE5LjQ3NzIgMzAgMjVDMzAgMzAuNTIyOCAyNS41MjI4IDM1IDIwIDM1QzE0LjQ3NzIgMzUgMTAgMzAuNTIyOCAxMCAyNUMxMCAxOS40NzcyIDE0LjQ3NzIgMTUgMjAgMTVaIiBmaWxsPSIjRDRENEY2Ii8+Cjwvc3ZnPgo=',
    blurUp: true,
    width: 400,
    height: 300,
  },
};

export const SquareImage: Story = {
  args: {
    src: 'https://picsum.photos/300/300',
    alt: 'Square image',
    aspectRatio: '1/1',
    className: 'w-48',
  },
};

export const WithFallback: Story = {
  args: {
    src: 'https://invalid-url-that-will-fail.com/image.jpg',
    alt: 'Image with fallback',
    fallbackSrc: 'https://picsum.photos/400/300?grayscale',
    width: 400,
    height: 300,
  },
};

export const LazyLoaded: Story = {
  args: {
    src: 'https://picsum.photos/600/400',
    alt: 'Lazy loaded image',
    lazy: true,
    rootMargin: '100px',
    width: 600,
    height: 400,
  },
};

export const ObjectFitContain: Story = {
  args: {
    src: 'https://picsum.photos/400/600',
    alt: 'Image with object-contain',
    objectFit: 'contain',
    aspectRatio: '2/3',
    className: 'w-48 h-64',
  },
};

export const CustomSkeleton: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Image with custom skeleton',
    skeletonComponent: (
      <div className="w-full h-full bg-gradient-to-r from-blue-200 to-purple-200 animate-pulse flex items-center justify-center">
        <span className="text-gray-600">Loading custom...</span>
      </div>
    ),
    width: 400,
    height: 300,
  },
};

export const NoSkeleton: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Image without skeleton',
    showSkeleton: false,
    width: 400,
    height: 300,
  },
};

export const WithCallbacks: Story = {
  args: {
    src: 'https://picsum.photos/400/300',
    alt: 'Image with callbacks',
    width: 400,
    height: 300,
    onLoad: (event) => {
      console.log('Image loaded:', event.currentTarget.src);
    },
    onError: (event) => {
      console.error('Image failed to load:', event.currentTarget.src);
    },
  },
};
