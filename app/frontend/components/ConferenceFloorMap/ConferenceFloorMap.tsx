"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, X, Users } from "lucide-react";
import { DEFAULT_BOOTHS, VIEWBOX_WIDTH, VIEWBOX_HEIGHT } from "./mockBooths";
import type { Booth } from "./types";

export interface ConferenceFloorMapProps {
  /** Defaults to a built-in mock conference layout if omitted. */
  booths?: Booth[];
  onBoothClick?: (booth: Booth) => void;
  /** Simulate periodic occupancy changes, like a live feed. Default: true. */
  simulateLiveOccupancy?: boolean;
  /** Milliseconds between simulated occupancy updates. Default: 4000. */
  updateInterval?: number;
  className?: string;
}

function occupancyRatio(booth: Booth): number {
  return booth.capacity > 0 ? booth.occupancy / booth.capacity : 0;
}

function occupancyFillClass(ratio: number): string {
  if (ratio > 0.85) return "fill-red-500";
  if (ratio > 0.6) return "fill-orange-500";
  if (ratio > 0.3) return "fill-amber-400";
  if (ratio > 0.1) return "fill-emerald-400";
  return "fill-zinc-200 dark:fill-zinc-700";
}

function occupancyStrokeClass(ratio: number): string {
  if (ratio > 0.85) return "stroke-red-600";
  if (ratio > 0.6) return "stroke-orange-600";
  if (ratio > 0.3) return "stroke-amber-500";
  if (ratio > 0.1) return "stroke-emerald-500";
  return "stroke-zinc-300 dark:stroke-zinc-600";
}

function occupancyBarColor(ratio: number): string {
  if (ratio >= 1) return "#ef4444";
  if (ratio >= 0.8) return "#f97316";
  return "#22c55e";
}

export default function ConferenceFloorMap({
  booths: boothsProp,
  onBoothClick,
  simulateLiveOccupancy = true,
  updateInterval = 4000,
  className = "",
}: ConferenceFloorMapProps) {
  const [booths, setBooths] = useState<Booth[]>(boothsProp ?? DEFAULT_BOOTHS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  useEffect(() => {
    setBooths(boothsProp ?? DEFAULT_BOOTHS);
  }, [boothsProp]);

  useEffect(() => {
    if (!simulateLiveOccupancy) return;

    const interval = setInterval(() => {
      setBooths((prev) =>
        prev.map((booth) => {
          const delta = Math.round(
            (Math.random() - 0.5) * booth.capacity * 0.15,
          );
          const next = Math.min(
            booth.capacity,
            Math.max(0, booth.occupancy + delta),
          );
          return { ...booth, occupancy: next };
        }),
      );
    }, updateInterval);

    return () => clearInterval(interval);
  }, [simulateLiveOccupancy, updateInterval]);

  const selectedBooth = booths.find((b) => b.id === selectedId) ?? null;

  const handleBoothClick = useCallback(
    (booth: Booth) => {
      setSelectedId(booth.id);
      onBoothClick?.(booth);
    },
    [onBoothClick],
  );

  const handleBoothKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGGElement>, booth: Booth) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleBoothClick(booth);
      }
    },
    [handleBoothClick],
  );

  return (
    <div
      className={`relative w-full aspect-[10/7] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden ${className}`}
    >
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => transformRef.current?.zoomIn()}
          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => transformRef.current?.zoomOut()}
          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => transformRef.current?.resetTransform()}
          className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Reset view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.15 }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="w-full h-full"
            role="img"
            aria-label="Conference floor map"
          >
            {booths.map((booth) => {
              const ratio = occupancyRatio(booth);
              const isHovered = hoveredId === booth.id;
              const isSelected = selectedId === booth.id;

              return (
                <g
                  key={booth.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${booth.label}, ${booth.occupancy} of ${booth.capacity} occupied`}
                  onClick={() => handleBoothClick(booth)}
                  onKeyDown={(event) => handleBoothKeyDown(event, booth)}
                  onMouseEnter={() => setHoveredId(booth.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer focus:outline-none"
                >
                  <rect
                    x={booth.x}
                    y={booth.y}
                    width={booth.width}
                    height={booth.height}
                    rx={8}
                    className={`${occupancyFillClass(ratio)} ${occupancyStrokeClass(ratio)} transition-all duration-500`}
                    strokeWidth={isSelected ? 4 : isHovered ? 3 : 1.5}
                    opacity={isHovered || isSelected ? 1 : 0.9}
                  />
                  <text
                    x={booth.x + booth.width / 2}
                    y={booth.y + booth.height / 2 - 6}
                    textAnchor="middle"
                    className="fill-white text-[13px] font-semibold pointer-events-none select-none"
                  >
                    {booth.label}
                  </text>
                  <text
                    x={booth.x + booth.width / 2}
                    y={booth.y + booth.height / 2 + 14}
                    textAnchor="middle"
                    className="fill-white/90 text-[11px] pointer-events-none select-none"
                  >
                    {booth.occupancy}/{booth.capacity}
                  </text>
                </g>
              );
            })}
          </svg>
        </TransformComponent>
      </TransformWrapper>

      <AnimatePresence>
        {selectedBooth && (
          <motion.div
            key={selectedBooth.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 z-30 h-full w-full max-w-[260px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl p-4 flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedBooth.label}
                </h4>
                {selectedBooth.category && (
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selectedBooth.category}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close booth details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>Live occupancy</span>
            </div>

            <div className="flex justify-between items-end mb-1.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {selectedBooth.occupancy}
              </span>
              <span className="text-xs text-zinc-400">
                / {selectedBooth.capacity}
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={selectedBooth.occupancy}
              aria-valuemin={0}
              aria-valuemax={selectedBooth.capacity}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden"
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, occupancyRatio(selectedBooth) * 100)}%`,
                  backgroundColor: occupancyBarColor(
                    occupancyRatio(selectedBooth),
                  ),
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
