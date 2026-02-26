'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, MessageSquare, ThumbsUp, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/atoms/Skeleton';
import type { VideoItem } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const EXIT_ANIMATION_MS = 180;

export interface VideoComment {
  id: string;
  authorName: string;
  content: string;
  createdAtLabel?: string;
  likesCount?: number;
}

export interface VideoDetailData extends VideoItem {
  stats: {
    viewsCount?: number;
    likesCount?: number;
    commentsCount?: number;
  };
  comments: VideoComment[];
}

export interface VideoDetailModalProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toArray = (value: unknown): unknown[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

const formatMetric = (value?: number) => {
  if (value === undefined) {
    return '--';
  }
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
};

const normalizeComment = (value: unknown, index: number): VideoComment | null => {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const content = asString(source.content) ?? asString(source.text) ?? asString(source.body);
  if (!content) {
    return null;
  }

  return {
    id:
      asString(source.id) ??
      asString(source.commentId) ??
      asString(source.uuid) ??
      `comment-${index}`,
    authorName:
      asString(source.authorName) ??
      asString(source.author) ??
      asString(source.username) ??
      'Anonymous',
    content,
    createdAtLabel:
      asString(source.createdAtLabel) ??
      asString(source.createdAt) ??
      asString(source.timestamp),
    likesCount: asNumber(source.likesCount) ?? asNumber(source.likes),
  };
};

const extractComments = (payload: unknown): VideoComment[] => {
  const source = asObject(payload);
  if (!source) {
    return [];
  }

  const direct = toArray(source.comments);
  if (direct.length > 0) {
    return direct
      .map((comment, index) => normalizeComment(comment, index))
      .filter((comment): comment is VideoComment => Boolean(comment));
  }

  const dataNode = asObject(source.data);
  const nested = toArray(dataNode?.comments);
  if (nested.length > 0) {
    return nested
      .map((comment, index) => normalizeComment(comment, index))
      .filter((comment): comment is VideoComment => Boolean(comment));
  }

  const rootArray = toArray(payload);
  if (rootArray.length > 0) {
    return rootArray
      .map((comment, index) => normalizeComment(comment, index))
      .filter((comment): comment is VideoComment => Boolean(comment));
  }

  return [];
};

const normalizeDetail = (payload: unknown, videoId: string): VideoDetailData => {
  const root = asObject(payload) ?? {};
  const dataNode = asObject(root.data) ?? root;
  const videoNode = asObject(dataNode.video) ?? dataNode;
  const statsNode = asObject(videoNode.stats) ?? asObject(dataNode.stats) ?? {};

  const comments = extractComments(payload);

  return {
    id:
      asString(videoNode.id) ??
      asString(videoNode.videoId) ??
      asString(dataNode.id) ??
      videoId,
    title:
      asString(videoNode.title) ??
      asString(videoNode.name) ??
      asString(dataNode.title) ??
      'Video details',
    thumbnailUrl:
      asString(videoNode.thumbnailUrl) ??
      asString(videoNode.thumbnail) ??
      asString(videoNode.imageUrl) ??
      asString(dataNode.thumbnailUrl),
    videoUrl:
      asString(videoNode.videoUrl) ??
      asString(videoNode.url) ??
      asString(dataNode.videoUrl),
    creatorName:
      asString(videoNode.creatorName) ??
      asString(videoNode.channelName) ??
      asString(videoNode.author) ??
      asString(dataNode.creatorName),
    description:
      asString(videoNode.description) ??
      asString(dataNode.description) ??
      'No description available.',
    durationLabel:
      asString(videoNode.durationLabel) ??
      asString(videoNode.duration) ??
      asString(dataNode.durationLabel),
    viewsLabel:
      asString(videoNode.viewsLabel) ??
      asString(dataNode.viewsLabel),
    publishedLabel:
      asString(videoNode.publishedLabel) ??
      asString(videoNode.publishedAt) ??
      asString(dataNode.publishedLabel),
    stats: {
      viewsCount:
        asNumber(statsNode.viewsCount) ??
        asNumber(statsNode.views) ??
        asNumber(videoNode.viewsCount) ??
        asNumber(videoNode.views),
      likesCount:
        asNumber(statsNode.likesCount) ??
        asNumber(statsNode.likes) ??
        asNumber(videoNode.likesCount) ??
        asNumber(videoNode.likes),
      commentsCount:
        asNumber(statsNode.commentsCount) ??
        asNumber(statsNode.comments) ??
        asNumber(videoNode.commentsCount) ??
        comments.length,
    },
    comments,
  };
};

const buildApiUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export function VideoDetailModal({ videoId, isOpen, onClose }: VideoDetailModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [detail, setDetail] = useState<VideoDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) {
      return;
    }

    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, EXIT_ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  const loadDetail = useCallback(async () => {
    if (!isOpen || !videoId) {
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsLoading(true);
    setError(null);
    setDetail(null);

    try {
      const detailResponse = await fetch(buildApiUrl(`/videos/${encodeURIComponent(videoId)}`), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!detailResponse.ok) {
        throw new Error(`Request failed with status ${detailResponse.status}`);
      }

      const detailPayload = (await detailResponse.json()) as unknown;
      let normalizedDetail = normalizeDetail(detailPayload, videoId);

      if (normalizedDetail.comments.length === 0) {
        const commentsResponse = await fetch(
          buildApiUrl(`/videos/${encodeURIComponent(videoId)}/comments`),
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          },
        );

        if (commentsResponse.ok) {
          const commentsPayload = (await commentsResponse.json()) as unknown;
          const comments = extractComments(commentsPayload);
          if (comments.length > 0) {
            normalizedDetail = {
              ...normalizedDetail,
              comments,
              stats: {
                ...normalizedDetail.stats,
                commentsCount: normalizedDetail.stats.commentsCount ?? comments.length,
              },
            };
          }
        }
      }

      if (requestRef.current !== requestId) {
        return;
      }

      setDetail(normalizedDetail);
      setIsLoading(false);
    } catch (loadError) {
      if (requestRef.current !== requestId) {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load video details.',
      );
      setIsLoading(false);
    }
  }, [isOpen, videoId]);

  useEffect(() => {
    if (!isOpen || !videoId) {
      return;
    }
    void loadDetail();
  }, [isOpen, videoId, refreshSeed, loadDetail]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-5 sm:px-6">
      <button
        type="button"
        aria-label="Close video details"
        onClick={onClose}
        className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] ${
          isClosing ? 'animate-video-detail-overlay-exit' : 'animate-video-detail-overlay-enter'
        }`}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-detail-modal-title"
        className={`relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface)] shadow-2xl ${
          isClosing ? 'animate-video-detail-modal-exit' : 'animate-video-detail-modal-enter'
        }`}
      >
        <header className="flex items-start justify-between border-b border-[var(--border-default)] px-5 py-4 sm:px-6">
          <div className="pr-4">
            <h2 id="video-detail-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {detail?.title ?? 'Loading video details'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {detail?.creatorName ?? 'Video details and engagement metrics'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)] dark:hover:bg-[var(--gray-800)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {isLoading ? (
            <>
              <Skeleton variant="rounded" height={220} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Skeleton variant="rounded" height={68} />
                <Skeleton variant="rounded" height={68} />
                <Skeleton variant="rounded" height={68} />
              </div>
              <div className="space-y-2">
                <Skeleton variant="text" width="44%" />
                <Skeleton variant="text" />
                <Skeleton variant="text" width="92%" />
                <Skeleton variant="text" width="76%" />
              </div>
              <div className="space-y-3">
                <Skeleton variant="text" width="35%" />
                <Skeleton variant="rounded" height={74} />
                <Skeleton variant="rounded" height={74} />
              </div>
            </>
          ) : error ? (
            <div className="rounded-xl border border-[var(--color-error)] bg-[var(--color-error-muted)] px-4 py-4 text-sm text-[var(--color-error-muted-foreground)]">
              <p className="font-medium">Could not load video details.</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshSeed((previous) => previous + 1)}
                className="mt-3 rounded-md bg-[var(--color-error)] px-3 py-1.5 text-xs font-medium text-white"
              >
                Retry
              </button>
            </div>
          ) : detail ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)]">
                  <div className="relative h-0 pt-[56.25%]">
                    {detail.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={detail.thumbnailUrl}
                        alt={detail.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">
                        No thumbnail available
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3">
                    <p className="text-xs text-[var(--text-muted)]">Views</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                      <Eye className="h-4 w-4 text-[var(--text-secondary)]" />
                      {formatMetric(detail.stats.viewsCount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3">
                    <p className="text-xs text-[var(--text-muted)]">Likes</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                      <ThumbsUp className="h-4 w-4 text-[var(--text-secondary)]" />
                      {formatMetric(detail.stats.likesCount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3">
                    <p className="text-xs text-[var(--text-muted)]">Comments</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                      <MessageSquare className="h-4 w-4 text-[var(--text-secondary)]" />
                      {formatMetric(detail.stats.commentsCount)}
                    </p>
                  </div>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Description</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                  {detail.description ?? 'No description available.'}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Comments ({detail.comments.length})
                </h3>
                {detail.comments.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.comments.map((comment) => (
                      <li
                        key={comment.id}
                        className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            {comment.authorName}
                          </p>
                          {comment.createdAtLabel && (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {comment.createdAtLabel}
                            </p>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {comment.content}
                        </p>
                        {comment.likesCount !== undefined && (
                          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                            {formatMetric(comment.likesCount)} likes
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border-default)] px-4 py-5 text-sm text-[var(--text-muted)]">
                    No comments yet.
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-lg border border-[var(--border-default)] px-4 py-5 text-sm text-[var(--text-muted)]">
              No detail data available.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

