# ConferenceFloorMap Component — Design

Issue: #598 — Build a ConferenceFloorMap Component

## Context

Acceptance criteria: zoom, pan, clickable booths, live occupancy indicators,
responsive rendering.

Existing precedent in this repo (`components/EventCapacityIndicator`,
`src/components/attendance/AttendanceHeatmap.tsx`) establishes the pattern for
this kind of bounty-style component issue: a self-contained, props-driven
component with sensible mock defaults, simulated live updates via
`setInterval`, and no real backend wiring. This design follows that pattern.

There is no existing zoom/pan/canvas library or SVG-based visualization
precedent in the repo. `app/frontend/app/demo/page.tsx` is the existing
scratch page other demo components are wired into.

## Data model

```ts
export interface Booth {
  id: string;
  label: string;
  category?: string; // e.g. "Sponsor", "Startup", "Food"
  x: number;
  y: number;
  width: number;
  height: number; // SVG viewBox units, not pixels
  capacity: number;
  occupancy: number;
}
```

`x/y/width/height` are plain numbers in the SVG's `viewBox` coordinate space
(e.g. a 0–1000 x 0–600 grid), not percentages or pixels — this keeps booth
layout math simple and resolution-independent.

## Component API

```ts
export interface ConferenceFloorMapProps {
  booths?: Booth[];           // defaults to a built-in mock layout
  onBoothClick?: (booth: Booth) => void;
  simulateLiveOccupancy?: boolean; // default true
  updateInterval?: number;    // ms, default 4000
  className?: string;
}
```

- `booths` defaults to a realistic mock conference layout (a main hall +
  ~8–10 booths of varying categories) so the component is demoable with zero
  props, matching `EventCapacityIndicator`'s `totalCapacity`/`registeredCount`
  defaults pattern.
- When `simulateLiveOccupancy` is true (default), an internal `setInterval`
  nudges each booth's occupancy up/down by a small random delta, clamped to
  `[0, capacity]`, every `updateInterval` ms — same technique as
  `AttendanceHeatmap`/`EventCapacityIndicator`. If the caller passes `booths`
  explicitly, the component still simulates on top of the given values;
  passing a controlled/live-updating `booths` array under the parent's own
  control instead is a natural future extension, out of scope here (YAGNI).

## Rendering

- `react-zoom-pan-pinch`'s `<TransformWrapper>` wraps a `<TransformComponent>`
  containing a single `<svg viewBox="0 0 W H" preserveAspectRatio="xMidYMid meet">`.
- Each booth renders as a `<g>` containing a `<rect>` (fill color driven by
  occupancy ratio, reusing `AttendanceHeatmap`'s green → amber → orange → red
  heat scale so the two components read consistently) and a `<text>` label.
  Booths are real DOM nodes: `onClick`, `onMouseEnter`/`onMouseLeave` for
  hover state, and `role="button"` + `tabIndex`/`aria-label` for keyboard/
  screen-reader access.
- A small fixed toolbar (zoom in / zoom out / reset, `lucide-react` icons)
  sits as a sibling of `<TransformWrapper>`, calling its exposed
  `zoomIn()`/`zoomOut()`/`resetTransform()` methods via a ref — it must stay
  fixed on screen, not pan/zoom with the map.
- The outer container is a responsive `div` (`w-full`, height constrained via
  an aspect-ratio class) so the SVG's `viewBox` scaling handles responsive
  resizing without extra JS.

## Interaction

- Clicking a booth opens a non-blocking slide-in detail panel (anchored
  within the component, not a page-blocking modal — chosen over reusing
  `components/ui/AnimatedModal` so the map stays visible/interactive while a
  booth's detail is open, better suited to continued exploration). The panel
  shows label, category, and a live occupancy bar styled identically to
  `EventCapacityIndicator`'s progress bar (same color thresholds: green /
  amber "almost full" / red "full").
- `onBoothClick` fires on every booth click regardless of whether the panel
  is shown, so a consuming page can layer its own behavior (navigation, its
  own modal, analytics) on top.
- Clicking the panel's close button, or clicking a different booth, closes/
  replaces the panel. Clicking empty map space does not close it (avoids
  fighting with pan-drag gestures that start on empty space).

## Files

- `components/ConferenceFloorMap/ConferenceFloorMap.tsx` — main component
- `components/ConferenceFloorMap/mockBooths.ts` — default mock layout data
- `components/ConferenceFloorMap/index.ts` — barrel export
- `app/frontend/app/demo/page.tsx` — add a new `<section>` wiring the
  component in, matching the existing demo sections' structure
- `app/frontend/package.json` — add `react-zoom-pan-pinch` dependency

## Testing

No `.test.tsx` is planned. This frontend has no wired-up test runner (no
`test` script in `package.json`, no jest/vitest config) despite one existing
`.test.tsx` file (`EventCapacityIndicator.test.tsx`) that nothing currently
executes. Verification is manual: run the dev server, exercise zoom/pan/
click/responsive behavior against the demo page.

CI's `frontend-lint` and `frontend-typecheck` jobs both run with
`continue-on-error: true` (soft gates), but the component must still pass
both cleanly as a matter of code quality, not because CI enforces it.

## Out of scope

- Real backend/API integration for booth or occupancy data.
- A controlled live-data mode driven by external polling/websockets.
- Mobile-specific gesture tuning beyond what `react-zoom-pan-pinch` provides
  out of the box.
