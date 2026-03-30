'use client';

interface VideoPlayerStatsProps {
  videoSrc: string;
}

export default function VideoPlayerStats({ videoSrc }: VideoPlayerStatsProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
      Playback stats are loading.
      <span className="sr-only">{videoSrc}</span>
    </div>
  );
}