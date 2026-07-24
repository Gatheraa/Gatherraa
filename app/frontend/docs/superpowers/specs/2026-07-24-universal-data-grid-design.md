# UniversalDataGrid Design

Implements issue #611: "Build a UniversalDataGrid Component" — a reusable
enterprise-grade data grid with virtualization, sorting, filtering, column
pinning, export, and keyboard accessibility.

## Architecture

Built on `@tanstack/react-table` (headless sorting/filtering/column-pinning
state) and `@tanstack/react-virtual` (row virtualization). Both are new
dependencies; `@tanstack/react-query` is already used elsewhere in this repo,
so this keeps the grid ecosystem consistent.

Self-contained, generic, typed component following the pattern established by
`ConferenceFloorMap`/`EventCapacityIndicator`: its own folder, its own mock
data, wired into `app/demo/page.tsx`. It does not replace or touch the
existing `DataTable.tsx`/`ReusableTable.tsx` components — those are out of
scope for this issue.

## Files

- `components/UniversalDataGrid/types.ts` — `UniversalDataGridColumn<T>` and
  `UniversalDataGridProps<T>` generic types.
- `components/UniversalDataGrid/mockAttendees.ts` — 5,000 generated
  synthetic attendee rows (id, name, email, ticketType, status,
  registeredAt, checkedIn) plus the column definitions for the demo.
- `components/UniversalDataGrid/useCsvExport.ts` — hook that serializes a
  given rowset to CSV and triggers a browser download.
- `components/UniversalDataGrid/UniversalDataGrid.tsx` — the grid.
- `components/UniversalDataGrid/index.ts` — barrel export.

## Component API

```ts
interface UniversalDataGridColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => string | number;
  width?: number;
  enableSort?: boolean;   // default true
  enableFilter?: boolean; // default true
}

interface UniversalDataGridProps<T> {
  data: T[];
  columns: UniversalDataGridColumn<T>[];
  rowHeight?: number;   // default 40, used by the virtualizer
  height?: number;      // default 480, px height of the scroll viewport
  getRowId: (row: T) => string;
  className?: string;
}
```

## Interaction Model

- **Sorting**: clicking a header cycles asc → desc → none. Driven by
  TanStack Table's `sorting` state; only one column sorts at a time.
- **Filtering**: a small text input under each filterable header does
  substring matching against that column's accessed value, debounced
  ~200ms, driven by TanStack Table's `columnFilters` state.
- **Column pinning**: a pin icon in each header opens a small menu with
  "Pin left" / "Pin right" / "Unpin". Pinned columns use TanStack Table's
  pinning API and get `position: sticky` with a shadow divider at the
  pinned/unpinned boundary.
- **Export**: a toolbar button exports the currently filtered+sorted
  rowset (respecting active filters and sort order, but not virtualization
  — all matching rows are exported, not just the rendered window) as a
  CSV file via `useCsvExport`.
- **Virtualization**: the row body uses `@tanstack/react-virtual`'s
  `useVirtualizer` with a fixed `rowHeight`, rendering only the rows
  currently in (or near) the viewport inside a scrollable container of
  `height`.
- **Keyboard accessibility**: the grid follows the WAI-ARIA grid pattern.
  `role="grid"` on the container, `role="row"`/`role="columnheader"`/
  `role="gridcell"` on the relevant elements. Arrow keys move a
  roving-tabindex focused-cell indicator between cells (Up/Down/Left/
  Right); Enter/Space on a focused header cell triggers sort; Tab reaches
  the toolbar (export button) and each column's filter input in DOM
  order, before/after the grid body.

## Mock Data

5,000 generated attendee rows, large enough that virtualization's
performance benefit is visually obvious (an unvirtualized 5,000-row table
would noticeably jank on scroll). Deterministic generation (seeded index-based
values, not `Math.random()`), so the dataset is stable across renders/tests.

## Testing Approach

No `.test.tsx` file — this repo has no wired-up test runner (no `test`
script, no jest/vitest config), matching the precedent set by
`ConferenceFloorMap`. Verification is via `tsc --noEmit`, `eslint`, and a
live browser check (Playwright-driven): sort a column, filter a column,
pin a column, export CSV, and confirm keyboard arrow-key navigation moves
focus between cells with no console errors.

## Out of Scope

- Replacing `DataTable.tsx` or `ReusableTable.tsx` call sites.
- Server-side pagination/sorting/filtering (all data is client-side, in
  keeping with the mock-data-demo-component convention).
- Row selection/editing.
- Excel (.xlsx) export — CSV only.
