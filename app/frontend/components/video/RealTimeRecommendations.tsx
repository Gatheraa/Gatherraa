'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecommendationItem, RecommendationResponse } from './types';

type RecommendationPhase = 'idle' | 'entering' | 'exiting';

interface AnimatedRecommendation {
  video: RecommendationItem;
  phase: RecommendationPhase;
}

export interface RealTimeRecommendationsProps {
  currentVideoId: string;
  onVideoSelect: (video: RecommendationItem) => void;
  className?: string;
  title?: string;
  apiEndpoint?: string;
  wsEndpoint?: string;
  pollIntervalMs?: number;
  maxItems?: number;
  itemHeight?: number;
  initialRecommendations?: RecommendationItem[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_API_ENDPOINT = '/videos/:videoId/recommendations';
const DEFAULT_WS_ENDPOINT =
  process.env.NEXT_PUBLIC_RECOMMENDATIONS_WS_URL || '';

function replaceVideoIdToken(template: string, currentVideoId: string) {
  return template.replace(':videoId', encodeURIComponent(currentVideoId));
}

function normalizeRecommendation(
  item: unknown,
  index: number,
): RecommendationItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = item as Record<string, unknown>;
  const titleValue = candidate.title ?? candidate.name;
  const fallbackId = `${String(titleValue ?? 'video')}-${index}`;
  const idValue = candidate.id ?? candidate.videoId ?? candidate.slug ?? fallbackId;
  const title = String(titleValue ?? 'Untitled video');

  return {
    id: String(idValue),
    title,
    thumbnailUrl: typeof candidate.thumbnailUrl === 'string'
      ? candidate.thumbnailUrl
      : typeof candidate.thumbnail === 'string'
        ? candidate.thumbnail
        : typeof candidate.imageUrl === 'string'
          ? candidate.imageUrl
          : undefined,
    videoUrl: typeof candidate.videoUrl === 'string'
      ? candidate.videoUrl
      : typeof candidate.url === 'string'
        ? candidate.url
        : undefined,
    creatorName: typeof candidate.creatorName === 'string'
      ? candidate.creatorName
      : typeof candidate.channelName === 'string'
        ? candidate.channelName
        : typeof candidate.author === 'string'
          ? candidate.author
          : undefined,
    description: typeof candidate.description === 'string'
      ? candidate.description
      : undefined,
    durationLabel: typeof candidate.durationLabel === 'string'
      ? candidate.durationLabel
      : typeof candidate.duration === 'string'
        ? candidate.duration
        : undefined,
    viewsLabel: typeof candidate.viewsLabel === 'string'
      ? candidate.viewsLabel
      : typeof candidate.views === 'number'
        ? `${candidate.views.toLocaleString()} views`
        : undefined,
    publishedLabel: typeof candidate.publishedLabel === 'string'
      ? candidate.publishedLabel
      : typeof candidate.publishedAt === 'string'
        ? candidate.publishedAt
        : undefined,
    reasonLabel: typeof candidate.reasonLabel === 'string'
      ? candidate.reasonLabel
      : typeof candidate.reason === 'string'
        ? candidate.reason
        : undefined,
    score: typeof candidate.score === 'number' ? candidate.score : undefined,
  };
}

function extractRecommendations(payload: unknown): RecommendationItem[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item, index) => normalizeRecommendation(item, index))
      .filter((item): item is RecommendationItem => Boolean(item));
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const source = payload as RecommendationResponse & {
    items?: unknown[];
    type?: string;
  };

  const nested = source.data ?? source.recommendations ?? source.items;
  if (Array.isArray(nested)) {
    return nested
      .map((item, index) => normalizeRecommendation(item, index))
      .filter((item): item is RecommendationItem => Boolean(item));
  }

  return [];
}

function isRecommendationPayload(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return true;
  }
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  if (
    Array.isArray(candidate.data) ||
    Array.isArray(candidate.recommendations) ||
    Array.isArray(candidate.items)
  ) {
    return true;
  }

  return (
    candidate.type === 'recommendations' ||
    candidate.type === 'video_recommendations'
  );
}

function buildApiUrl(apiEndpoint: string, currentVideoId: string) {
  const resolvedEndpoint = replaceVideoIdToken(apiEndpoint, currentVideoId);
  if (resolvedEndpoint.startsWith('http://') || resolvedEndpoint.startsWith('https://')) {
    return resolvedEndpoint;
  }
  return `${API_BASE_URL}${resolvedEndpoint.startsWith('/') ? '' : '/'}${resolvedEndpoint}`;
}

function normalizeWsUrl(template: string, currentVideoId: string): string | null {
  const replaced = replaceVideoIdToken(template, currentVideoId);
  let absolute = replaced;

  if (absolute.startsWith('/')) {
    try {
      const apiUrl = new URL(API_BASE_URL);
      const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      absolute = `${wsProtocol}//${apiUrl.host}${absolute}`;
    } catch {
      return null;
    }
  } else if (absolute.startsWith('http://')) {
    absolute = absolute.replace('http://', 'ws://');
  } else if (absolute.startsWith('https://')) {
    absolute = absolute.replace('https://', 'wss://');
  }

  try {
    const parsed = new URL(absolute);
    if (!template.includes(':videoId')) {
      parsed.searchParams.set('videoId', currentVideoId);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function RealTimeRecommendations({
  currentVideoId,
  onVideoSelect,
  className = '',
  title = 'Recommended next',
  apiEndpoint = DEFAULT_API_ENDPOINT,
  wsEndpoint = DEFAULT_WS_ENDPOINT,
  pollIntervalMs = 30000,
  maxItems = 8,
  itemHeight = 96,
  initialRecommendations = [],
}: RealTimeRecommendationsProps) {
  const [items, setItems] = useState<AnimatedRecommendation[]>(
    initialRecommendations.slice(0, maxItems).map((video) => ({
      video,
      phase: 'idle',
    })),
  );
  const [loading, setLoading] = useState(initialRecommendations.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const phaseCleanupTimerRef = useRef<number | null>(null);
  const wsReconnectTimerRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fetchRequestRef = useRef(0);

  const displayMinHeight = useMemo(() => {
    const reservedRows = Math.min(maxItems, 4);
    return reservedRows * itemHeight + Math.max(reservedRows - 1, 0) * 8;
  }, [itemHeight, maxItems]);

  const applyRecommendations = useCallback(
    (nextRecommendations: RecommendationItem[]) => {
      const next = nextRecommendations.slice(0, maxItems);

      setItems((previousItems) => {
        const previousById = new Map(
          previousItems.map((item) => [item.video.id, item]),
        );
        const nextIds = new Set(next.map((video) => video.id));

        const merged: AnimatedRecommendation[] = next.map((video) => {
          const existing = previousById.get(video.id);
          return {
            video,
            phase:
              existing && existing.phase !== 'exiting' ? 'idle' : 'entering',
          };
        });

        for (const previous of previousItems) {
          if (!nextIds.has(previous.video.id)) {
            merged.push({
              video: previous.video,
              phase: 'exiting',
            });
          }
        }

        return merged;
      });

      setError(null);
      setLoading(false);
    },
    [maxItems],
  );

  const fetchRecommendations = useCallback(async () => {
    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;

    if (!currentVideoId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const requestUrl = buildApiUrl(apiEndpoint, currentVideoId);
      const response = await fetch(requestUrl, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (requestId !== fetchRequestRef.current) {
        return;
      }
      applyRecommendations(extractRecommendations(payload));
    } catch (fetchError) {
      if (requestId !== fetchRequestRef.current) {
        return;
      }
      setLoading(false);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not fetch recommendations.',
      );
    }
  }, [apiEndpoint, applyRecommendations, currentVideoId]);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  useEffect(() => {
    if (pollIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchRecommendations();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRecommendations, pollIntervalMs]);

  useEffect(() => {
    if (phaseCleanupTimerRef.current) {
      window.clearTimeout(phaseCleanupTimerRef.current);
      phaseCleanupTimerRef.current = null;
    }

    const hasTransientItems = items.some(
      (item) => item.phase === 'entering' || item.phase === 'exiting',
    );
    if (!hasTransientItems) {
      return;
    }

    phaseCleanupTimerRef.current = window.setTimeout(() => {
      setItems((previous) =>
        previous
          .filter((item) => item.phase !== 'exiting')
          .map((item) =>
            item.phase === 'entering' ? { ...item, phase: 'idle' } : item,
          ),
      );
      phaseCleanupTimerRef.current = null;
    }, 280);

    return () => {
      if (phaseCleanupTimerRef.current) {
        window.clearTimeout(phaseCleanupTimerRef.current);
        phaseCleanupTimerRef.current = null;
      }
    };
  }, [items]);

  useEffect(() => {
    if (!wsEndpoint || !currentVideoId) {
      return;
    }

    const wsUrl = normalizeWsUrl(wsEndpoint, currentVideoId);
    if (!wsUrl) {
      return;
    }

    let isActive = true;
    let retryAttempt = 0;

    const connect = () => {
      if (!isActive) {
        return;
      }

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.addEventListener('open', () => {
        if (!isActive) {
          return;
        }
        retryAttempt = 0;
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'subscribe_recommendations',
            videoId: currentVideoId,
          }),
        );
      });

      socket.addEventListener('message', (event) => {
        if (!isActive) {
          return;
        }

        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isRecommendationPayload(parsed)) {
            const next = extractRecommendations(parsed);
            applyRecommendations(next);
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      });

      socket.addEventListener('close', () => {
        if (!isActive) {
          return;
        }

        setWsConnected(false);
        if (retryAttempt >= 4) {
          return;
        }

        const backoffMs = Math.min(8000, 1000 * 2 ** retryAttempt);
        retryAttempt += 1;
        wsReconnectTimerRef.current = window.setTimeout(connect, backoffMs);
      });

      socket.addEventListener('error', () => {
        setWsConnected(false);
      });
    };

    connect();

    return () => {
      isActive = false;
      setWsConnected(false);
      if (wsReconnectTimerRef.current) {
        window.clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [applyRecommendations, currentVideoId, wsEndpoint]);

  return (
    <section
      className={`rounded-xl border border-[var(--border-default)] bg-[var(--surface)] p-4 ${className}`.trim()}
      aria-live="polite"
      aria-busy={loading}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <span
            className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-[var(--gray-400)]'}`}
            aria-hidden
          />
          {wsConnected ? 'Live' : 'Polling'}
        </span>
      </header>

      <ul
        className="space-y-2"
        style={{ minHeight: `${displayMinHeight}px` }}
        aria-label="Video recommendations"
      >
        {items.map((item) => (
          <li
            key={item.video.id}
            style={{ height: `${itemHeight}px` }}
            className={`overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] ${
              item.phase === 'entering'
                ? 'animate-recommendation-enter'
                : item.phase === 'exiting'
                  ? 'animate-recommendation-exit'
                  : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onVideoSelect(item.video)}
              className="flex h-full w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--gray-100)] dark:hover:bg-[var(--gray-800)]"
              aria-label={`Play recommended video: ${item.video.title}`}
            >
              <div className="relative h-full w-28 shrink-0 overflow-hidden rounded bg-[var(--border-muted)]">
                {item.video.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.video.thumbnailUrl}
                    alt={item.video.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-muted)]">
                    No preview
                  </div>
                )}
                {item.video.durationLabel && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white">
                    {item.video.durationLabel}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {item.video.title}
                </h3>
                {item.video.creatorName && (
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {item.video.creatorName}
                  </p>
                )}
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {[item.video.viewsLabel, item.video.publishedLabel]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
                {item.video.reasonLabel && (
                  <p className="truncate text-xs text-[var(--color-primary)]">
                    {item.video.reasonLabel}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}

        {loading &&
          items.length === 0 &&
          Array.from({ length: Math.min(maxItems, 4) }).map((_, index) => (
            <li
              key={`recommendation-skeleton-${index}`}
              style={{ height: `${itemHeight}px` }}
              className="animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)]"
              aria-hidden
            />
          ))}
      </ul>

      {error && (
        <p className="mt-3 text-xs text-[var(--color-error)]">
          Failed to refresh recommendations: {error}
        </p>
      )}
    </section>
  );
}
