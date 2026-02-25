'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { VideoGridConfig, VideoItem } from './types';

export interface DynamicVideoGridProps {
  videos: VideoItem[];
  onVideoSelect: (video: VideoItem) => void;
  gridConfig?: VideoGridConfig;
  className?: string;
  emptyMessage?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

const defaultGridConfig: Required<VideoGridConfig> = {
  containerHeight: '70vh',
  gap: 16,
  rowHeight: 290,
  overscanRows: 2,
  minColumnWidth: 240,
  mobileColumns: 1,
  tabletColumns: 2,
  desktopColumns: 4,
  mobileBreakpoint: 768,
  desktopBreakpoint: 1200,
  animateCards: true,
};

const getCssSize = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

export function DynamicVideoGrid({
  videos,
  onVideoSelect,
  gridConfig,
  className = '',
  emptyMessage = 'No videos to display.',
  onEndReached,
  endReachedThreshold = 200,
}: DynamicVideoGridProps) {
  const config = useMemo(
    () => ({ ...defaultGridConfig, ...gridConfig }),
    [gridConfig],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      setContainerWidth(container.clientWidth);
      setViewportHeight(container.clientHeight);
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => {
        window.removeEventListener('resize', updateSize);
      };
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const layout = useMemo(() => {
    const width = Math.max(1, containerWidth);
    const maxColumnsByWidth = Math.max(
      1,
      Math.floor((width + config.gap) / (config.minColumnWidth + config.gap)),
    );
    const preferredColumns =
      width < config.mobileBreakpoint
        ? config.mobileColumns
        : width < config.desktopBreakpoint
          ? config.tabletColumns
          : config.desktopColumns;
    const columns = Math.max(1, Math.min(preferredColumns, maxColumnsByWidth));
    const cardWidth = (width - config.gap * (columns - 1)) / columns;
    const rowCount = Math.ceil(videos.length / columns);
    const totalHeight = rowCount * config.rowHeight;
    const safeViewportHeight = viewportHeight > 0 ? viewportHeight : config.rowHeight * 3;

    if (rowCount === 0) {
      return {
        columns,
        cardWidth,
        cardHeight: config.rowHeight - config.gap,
        rowCount,
        totalHeight: 0,
        visibleStartIndex: 0,
        visibleEndIndex: -1,
      };
    }

    const startRow = Math.max(
      0,
      Math.floor(scrollTop / config.rowHeight) - config.overscanRows,
    );
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollTop + safeViewportHeight) / config.rowHeight) + config.overscanRows,
    );

    return {
      columns,
      cardWidth,
      cardHeight: config.rowHeight - config.gap,
      rowCount,
      totalHeight,
      visibleStartIndex: startRow * columns,
      visibleEndIndex: Math.min(videos.length - 1, (endRow + 1) * columns - 1),
    };
  }, [config, containerWidth, scrollTop, videos.length, viewportHeight]);

  const visibleVideos = useMemo(() => {
    if (layout.visibleEndIndex < layout.visibleStartIndex) {
      return [];
    }
    return videos.slice(layout.visibleStartIndex, layout.visibleEndIndex + 1);
  }, [layout.visibleEndIndex, layout.visibleStartIndex, videos]);

  if (videos.length === 0) {
    return (
      <div
        className={`rounded-xl border border-[var(--border-default)] bg-[var(--surface)] p-8 text-center text-[var(--text-secondary)] ${className}`.trim()}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface)] p-4 ${className}`.trim()}
      style={{ height: getCssSize(config.containerHeight) }}
      onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        setScrollTop(scrollTop);
        
        if (onEndReached && scrollHeight - scrollTop - clientHeight < endReachedThreshold) {
          onEndReached();
        }
      }}
      role="list"
      aria-label="Video grid"
    >
      <div
        className="relative"
        style={{
          height: `${layout.totalHeight}px`,
          minHeight: `${Math.max(layout.rowCount, 1) * config.rowHeight}px`,
        }}
      >
        {visibleVideos.map((video, visibleIndex) => {
          const index = layout.visibleStartIndex + visibleIndex;
          const row = Math.floor(index / layout.columns);
          const column = index % layout.columns;
          const left = column * (layout.cardWidth + config.gap);
          const top = row * config.rowHeight;

          return (
            <article
              key={video.id}
              role="listitem"
              className="absolute"
              style={{
                left,
                top,
                width: layout.cardWidth,
                height: layout.cardHeight,
                contain: 'layout paint style',
                animation: config.animateCards
                  ? 'video-grid-card-enter 320ms cubic-bezier(0.18, 0.9, 0.32, 1) both'
                  : undefined,
                animationDelay: config.animateCards
                  ? `${Math.min(220, (index % layout.columns) * 35)}ms`
                  : undefined,
              }}
            >
              <button
                type="button"
                className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface)] text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                onClick={() => onVideoSelect(video)}
                aria-label={`Open video: ${video.title}`}
              >
                <div className="relative h-0 w-full overflow-hidden bg-[var(--border-muted)] pt-[56.25%]">
                  {video.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">
                      No thumbnail
                    </div>
                  )}
                  {video.durationLabel && (
                    <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-xs font-medium text-white">
                      {video.durationLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 px-3 py-3">
                  <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                    {video.title}
                  </h3>
                  {video.creatorName && (
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {video.creatorName}
                    </p>
                  )}
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {[video.viewsLabel, video.publishedLabel]
                      .filter(Boolean)
                      .join(' | ')}
                  </p>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
