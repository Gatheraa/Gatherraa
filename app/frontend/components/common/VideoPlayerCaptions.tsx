'use client';

interface VideoPlayerCaptionsProps {
  videoSrc: string;
}

export default function VideoPlayerCaptions({ videoSrc }: VideoPlayerCaptionsProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      Captions are not available for this source yet.
      <span className="sr-only">{videoSrc}</span>
    </div>
  );
}