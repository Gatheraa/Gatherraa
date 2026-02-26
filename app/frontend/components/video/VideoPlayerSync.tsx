'use client';

import React, {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

export interface PersistedPlaybackState {
  currentTime: number;
  duration: number | null;
  paused: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  updatedAt: number;
}

export interface VideoPlayerSyncProps
  extends React.VideoHTMLAttributes<HTMLVideoElement> {
  videoId: string;
  persistKey?: string;
  storageScope?: 'session' | 'local';
  autoResume?: boolean;
  syncIntervalMs?: number;
  clearOnEnded?: boolean;
  onPlaybackStateChange?: (state: PersistedPlaybackState) => void;
}

function assignRef(
  ref: ForwardedRef<HTMLVideoElement>,
  value: HTMLVideoElement | null,
) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) {
    ref.current = value;
  }
}

export const VideoPlayerSync = forwardRef<HTMLVideoElement, VideoPlayerSyncProps>(
  (
    {
      videoId,
      persistKey,
      storageScope = 'session',
      autoResume = true,
      syncIntervalMs = 1000,
      clearOnEnded = false,
      onPlaybackStateChange,
      controls = true,
      className = '',
      ...props
    },
    forwardedRef,
  ) => {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const lastTimeSyncRef = useRef(0);
    const storageKey = useMemo(
      () => persistKey ?? `gatheraa:video-playback:${videoId}`,
      [persistKey, videoId],
    );

    const getStorage = useCallback(() => {
      if (typeof window === 'undefined') {
        return null;
      }
      return storageScope === 'local'
        ? window.localStorage
        : window.sessionStorage;
    }, [storageScope]);

    const readState = useCallback((): PersistedPlaybackState | null => {
      const storage = getStorage();
      if (!storage) {
        return null;
      }
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as PersistedPlaybackState;
      } catch {
        return null;
      }
    }, [getStorage, storageKey]);

    const removeState = useCallback(() => {
      const storage = getStorage();
      if (!storage) {
        return;
      }
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore persistence failures in private mode / restricted storage.
      }
    }, [getStorage, storageKey]);

    const persistCurrentState = useCallback(() => {
      const videoElement = localVideoRef.current;
      const storage = getStorage();
      if (!videoElement || !storage) {
        return;
      }

      const nextState: PersistedPlaybackState = {
        currentTime: Number.isFinite(videoElement.currentTime)
          ? videoElement.currentTime
          : 0,
        duration: Number.isFinite(videoElement.duration)
          ? videoElement.duration
          : null,
        paused: videoElement.paused,
        volume: videoElement.volume,
        muted: videoElement.muted,
        playbackRate: videoElement.playbackRate,
        updatedAt: Date.now(),
      };

      try {
        storage.setItem(storageKey, JSON.stringify(nextState));
        onPlaybackStateChange?.(nextState);
      } catch {
        // Ignore persistence failures in private mode / restricted storage.
      }
    }, [getStorage, onPlaybackStateChange, storageKey]);

    useEffect(() => {
      const videoElement = localVideoRef.current;
      if (!videoElement) {
        return;
      }

      const restoreState = () => {
        const savedState = readState();
        if (!savedState) {
          return;
        }

        if (
          Number.isFinite(savedState.currentTime) &&
          savedState.currentTime > 0 &&
          Number.isFinite(videoElement.duration)
        ) {
          videoElement.currentTime = Math.min(
            savedState.currentTime,
            Math.max(0, videoElement.duration - 0.1),
          );
        }

        videoElement.volume = savedState.volume;
        videoElement.muted = savedState.muted;
        videoElement.playbackRate = savedState.playbackRate;

        if (autoResume && !savedState.paused) {
          void videoElement.play().catch(() => {
            // Browsers can block autoplay if not user-initiated.
          });
        }
      };

      if (videoElement.readyState >= 1) {
        restoreState();
      } else {
        videoElement.addEventListener('loadedmetadata', restoreState);
      }

      return () => {
        videoElement.removeEventListener('loadedmetadata', restoreState);
      };
    }, [autoResume, readState, videoId]);

    useEffect(() => {
      const videoElement = localVideoRef.current;
      if (!videoElement) {
        return;
      }

      const handlePlaybackEvent = (event: Event) => {
        if (event.type === 'timeupdate') {
          const now = Date.now();
          if (now - lastTimeSyncRef.current < syncIntervalMs) {
            return;
          }
          lastTimeSyncRef.current = now;
        }

        if (event.type === 'ended' && clearOnEnded) {
          removeState();
          return;
        }

        persistCurrentState();
      };

      const syncEvents: Array<keyof HTMLMediaElementEventMap> = [
        'play',
        'pause',
        'timeupdate',
        'seeking',
        'ratechange',
        'volumechange',
        'ended',
      ];

      for (const eventName of syncEvents) {
        videoElement.addEventListener(eventName, handlePlaybackEvent);
      }

      const flushOnHidden = () => {
        if (document.visibilityState === 'hidden') {
          persistCurrentState();
        }
      };

      window.addEventListener('pagehide', persistCurrentState);
      document.addEventListener('visibilitychange', flushOnHidden);

      return () => {
        for (const eventName of syncEvents) {
          videoElement.removeEventListener(eventName, handlePlaybackEvent);
        }
        window.removeEventListener('pagehide', persistCurrentState);
        document.removeEventListener('visibilitychange', flushOnHidden);
        persistCurrentState();
      };
    }, [clearOnEnded, persistCurrentState, removeState, syncIntervalMs]);

    return (
      <video
        ref={(node) => {
          localVideoRef.current = node;
          assignRef(forwardedRef, node);
        }}
        controls={controls}
        className={`w-full rounded-xl bg-black ${className}`.trim()}
        {...props}
      />
    );
  },
);

VideoPlayerSync.displayName = 'VideoPlayerSync';

