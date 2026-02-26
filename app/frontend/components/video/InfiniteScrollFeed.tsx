'use client';

import React, { useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { DynamicVideoGrid } from './DynamicVideoGrid';
import type { VideoGridConfig, VideoItem } from './types';

export interface InfiniteScrollFeedProps {
  fetchVideos: (pageParam: unknown, batchSize: number) => Promise<{ items: VideoItem[]; nextCursor?: unknown }>;
  queryKey: string[];
  batchSize?: number;
  gridConfig?: VideoGridConfig;
  className?: string;
  emptyMessage?: string;
  onVideoSelect: (video: VideoItem) => void;
}

export function InfiniteScrollFeed({
  fetchVideos,
  queryKey,
  batchSize = 20,
  gridConfig,
  className = '',
  emptyMessage = 'No videos found.',
  onVideoSelect,
}: InfiniteScrollFeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchVideos(pageParam, batchSize),
    initialPageParam: 0 as unknown,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allVideos = data?.pages.flatMap((page) => page.items) || [];

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-600">
        <p className="font-medium">Error loading feed</p>
        <p className="mt-1 text-sm opacity-75">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col ${className}`}>
      <DynamicVideoGrid
        videos={allVideos}
        onVideoSelect={onVideoSelect}
        gridConfig={gridConfig}
        emptyMessage={status === 'pending' ? 'Loading videos...' : emptyMessage}
        onEndReached={handleEndReached}
        endReachedThreshold={600}
      />
      
      {isFetchingNextPage && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transform">
          <div className="flex items-center gap-2 rounded-full bg-[var(--surface)]/90 px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-lg backdrop-blur-md border border-[var(--border-default)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
            <span>Loading more...</span>
          </div>
        </div>
      )}
    </div>
  );
}