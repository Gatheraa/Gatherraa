'use client';

interface VideoPlayerCommentsProps {
  videoSrc: string;
}

export default function VideoPlayerComments({ videoSrc }: VideoPlayerCommentsProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      Comments are currently unavailable.
      <span className="sr-only">{videoSrc}</span>
    </div>
  );
}