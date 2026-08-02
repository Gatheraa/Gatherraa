"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useMemo, type ReactNode } from "react";

// ─── Preset transition definitions ───────────────────────────────────────────

export type TransitionPreset =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale"
  | "none";

interface PresetDefinition {
  /** Variants object passed to motion.div for enter/exit */
  variants: Variants;
  /** Transition options for the motion.div */
  transition: {
    type?: string;
    duration: number;
    ease?: string | number[];
    delay?: number;
  };
}

const PRESETS: Record<TransitionPreset, PresetDefinition> = {
  fade: {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    transition: { duration: 0.2, ease: "easeInOut" },
  },

  "slide-up": {
    variants: {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -16 },
    },
    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
  },

  "slide-down": {
    variants: {
      initial: { opacity: 0, y: -24 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 16 },
    },
    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
  },

  "slide-left": {
    variants: {
      initial: { opacity: 0, x: 32 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -16 },
    },
    transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
  },

  "slide-right": {
    variants: {
      initial: { opacity: 0, x: -32 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 16 },
    },
    transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
  },

  scale: {
    variants: {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.02 },
    },
    transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
  },

  none: {
    variants: {
      initial: {},
      animate: {},
      exit: {},
    },
    transition: { duration: 0 },
  },
};

// ─── Route-based preset mapping ──────────────────────────────────────────────

export type RoutePresetMap = Record<string, TransitionPreset>;

/**
 * Default route-to-preset mapping.
 * Override via the `routePresets` prop on `AnimatedPageTransition`.
 */
const DEFAULT_ROUTE_PRESETS: RoutePresetMap = {
  "/": "fade",
  "/dashboard": "slide-up",
  "/dashboard/new": "slide-up",
  "/missions": "fade",
  "/mission": "slide-left",
  "/events": "slide-up",
  "/events/create": "slide-right",
  "/dao": "fade",
  "/dao/": "fade",
  "/profile": "slide-right",
  "/demo": "scale",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Match a pathname against the route preset map.
 * Exact match first, then prefix match (e.g. "/mission/123" matches "/mission").
 */
function matchPreset(
  pathname: string,
  map: RoutePresetMap,
  fallback: TransitionPreset,
): TransitionPreset {
  if (map[pathname]) return map[pathname];
  // Prefix match: look for the longest matching prefix
  const sorted = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(key)) return map[key];
  }
  return fallback;
}

/**
 * Resolve prefers-reduced-motion at runtime.
 * Returns `true` when the user prefers reduced motion.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── AnimatedPageTransition ─────────────────────────────────────────────────

interface AnimatedPageTransitionProps {
  children: ReactNode;
  /** Override the default route-to-preset mapping */
  routePresets?: RoutePresetMap;
  /** Fallback preset when no route matches (default: "fade") */
  fallbackPreset?: TransitionPreset;
  /**
   * When true, all animations are skipped regardless of preset.
   * Useful for testing or programmatic bypass.
   */
  disableAnimations?: boolean;
  /** Additional CSS class names forwarded to the wrapper div */
  className?: string;
}

/**
 * AnimatedPageTransition — wraps page content with route-based enter/exit
 * animations powered by framer-motion.
 *
 * Usage in a layout:
 * ```tsx
 * <AnimatedPageTransition>
 *   {children}
 * </AnimatedPageTransition>
 * ```
 *
 * Features:
 * - **Multiple presets**: fade, slide-up/down/left/right, scale, none
 * - **Reduced motion**: respects `prefers-reduced-motion: reduce`
 * - **Exit animations**: animate out before the next page enters
 * - **Nested routes**: prefix-based matching for nested route transitions
 * - **Per-route overrides**: pass a custom `routePresets` map
 */
export default function AnimatedPageTransition({
  children,
  routePresets,
  fallbackPreset = "fade",
  disableAnimations = false,
  className,
}: AnimatedPageTransitionProps) {
  const pathname = usePathname();
  const mergedPresets = routePresets ?? DEFAULT_ROUTE_PRESETS;

  // Resolve the transition preset for the current route
  const preset = useMemo<PresetDefinition>(
    () => {
      if (disableAnimations || prefersReducedMotion()) {
        return PRESETS.none;
      }
      const presetName = matchPreset(pathname, mergedPresets, fallbackPreset);
      return PRESETS[presetName];
    },
    [pathname, mergedPresets, fallbackPreset, disableAnimations],
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={preset.variants}
        transition={preset.transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}