"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  X,
  Plus,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MISSION_CATEGORIES = [
  "Exploration",
  "Combat",
  "Delivery",
  "Rescue",
  "Recon",
  "Escort",
  "Sabotage",
  "Collection",
] as const;

export type MissionCategory = (typeof MISSION_CATEGORIES)[number];

export const FILTER_FIELDS = [
  { key: "status", label: "Status" },
  { key: "difficulty", label: "Difficulty" },
  { key: "location", label: "Location" },
  { key: "assignee", label: "Assignee" },
] as const;

export type FilterFieldKey = (typeof FILTER_FIELDS)[number]["key"];

export const FILTER_OPERATORS = [
  "is",
  "is not",
  "contains",
  "starts with",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type CombineMode = "AND" | "OR";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterRow {
  id: string;
  field: FilterFieldKey;
  operator: FilterOperator;
  value: string;
}

export interface QueryState {
  combineMode: CombineMode;
  filters: FilterRow[];
  rewardMin: number;
  rewardMax: number;
  categories: MissionCategory[];
}

// ── URL Serialisation ─────────────────────────────────────────────────────────

function stateToParams(state: QueryState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("mode", state.combineMode);
  p.set("rMin", String(state.rewardMin));
  p.set("rMax", String(state.rewardMax));
  if (state.categories.length) p.set("cats", state.categories.join(","));
  if (state.filters.length) p.set("filters", JSON.stringify(state.filters));
  return p;
}

function paramsToState(p: URLSearchParams): Partial<QueryState> {
  const out: Partial<QueryState> = {};
  const mode = p.get("mode");
  if (mode === "AND" || mode === "OR") out.combineMode = mode;
  const rMin = Number(p.get("rMin"));
  const rMax = Number(p.get("rMax"));
  if (!isNaN(rMin) && rMin >= 0) out.rewardMin = rMin;
  if (!isNaN(rMax) && rMax > 0) out.rewardMax = rMax;
  const cats = p.get("cats");
  if (cats) {
    out.categories = cats
      .split(",")
      .filter((c) =>
        MISSION_CATEGORIES.includes(c as MissionCategory),
      ) as MissionCategory[];
  }
  try {
    const f = p.get("filters");
    if (f) out.filters = JSON.parse(f);
  } catch {}
  return out;
}

const DEFAULT_STATE: QueryState = {
  combineMode: "AND",
  filters: [],
  rewardMin: 0,
  rewardMax: 10000,
  categories: [],
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SelectProps {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  className?: string;
}

function Select({ value, options, onChange, className = "" }: SelectProps) {
  return (
    <div className={["relative inline-flex items-center", className].join(" ")}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none cursor-pointer",
          "pl-3 pr-8 py-2 text-sm rounded-md",
          "bg-secondary text-secondary-foreground border border-border",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          "transition-colors duration-150",
        ].join(" ")}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 text-muted-foreground"
      />
    </div>
  );
}

interface FilterRowItemProps {
  row: FilterRow;
  index: number;
  combineMode: CombineMode;
  isOnly: boolean;
  onChange: (id: string, patch: Partial<FilterRow>) => void;
  onRemove: (id: string) => void;
}

function FilterRowItem({
  row,
  index,
  combineMode,
  isOnly,
  onChange,
  onRemove,
}: FilterRowItemProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Connector badge */}
      <span className="w-10 text-center text-[11px] font-semibold tracking-widest text-muted-foreground select-none">
        {index === 0 ? "WHERE" : combineMode}
      </span>

      {/* Field */}
      <Select
        value={row.field}
        options={FILTER_FIELDS.map((f) => f.key)}
        onChange={(v) => onChange(row.id, { field: v as FilterFieldKey })}
      />

      {/* Operator */}
      <Select
        value={row.operator}
        options={FILTER_OPERATORS}
        onChange={(v) => onChange(row.id, { operator: v as FilterOperator })}
      />

      {/* Value */}
      <input
        type="text"
        value={row.value}
        placeholder="value…"
        onChange={(e) => onChange(row.id, { value: e.target.value })}
        className={[
          "flex-1 min-w-[120px] max-w-[220px]",
          "px-3 py-2 text-sm rounded-md",
          "bg-background border border-border text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          "transition-colors duration-150",
        ].join(" ")}
      />

      {/* Remove */}
      {!isOnly && (
        <button
          onClick={() => onRemove(row.id)}
          aria-label="Remove filter"
          className={[
            "p-1.5 rounded-md",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "transition-colors duration-150",
          ].join(" ")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ── Range Slider ──────────────────────────────────────────────────────────────

interface RangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  onChange: (min: number, max: number) => void;
}

function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step = 100,
  onChange,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pctLeft = ((valueMin - min) / (max - min)) * 100;
  const pctRight = ((valueMax - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex justify-between mb-3 text-sm font-medium text-foreground">
        <span>${valueMin.toLocaleString()}</span>
        <span>${valueMax.toLocaleString()}</span>
      </div>

      {/* Track */}
      <div ref={trackRef} className="relative h-5 flex items-center">
        {/* Base track */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
        {/* Active range */}
        <div
          className="absolute h-1.5 rounded-full bg-primary"
          style={{ left: `${pctLeft}%`, right: `${100 - pctRight}%` }}
        />

        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), valueMax - step);
            onChange(v, valueMax);
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: valueMin > max - 100 ? 5 : 3 }}
        />

        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), valueMin + step);
            onChange(valueMin, v);
          }}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 4 }}
        />

        {/* Visual thumb min */}
        <div
          className={[
            "absolute w-4 h-4 rounded-full -translate-x-1/2",
            "bg-primary border-2 border-primary-foreground shadow-md",
            "ring-0 transition-shadow duration-150",
            "pointer-events-none",
          ].join(" ")}
          style={{ left: `${pctLeft}%` }}
        />
        {/* Visual thumb max */}
        <div
          className={[
            "absolute w-4 h-4 rounded-full -translate-x-1/2",
            "bg-primary border-2 border-primary-foreground shadow-md",
            "pointer-events-none",
          ].join(" ")}
          style={{ left: `${pctRight}%` }}
        />
      </div>

      {/* Min / Max hints */}
      <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Category Multi-select ─────────────────────────────────────────────────────

interface CategorySelectProps {
  selected: MissionCategory[];
  onChange: (cats: MissionCategory[]) => void;
}

function CategoryMultiSelect({ selected, onChange }: CategorySelectProps) {
  const toggle = (cat: MissionCategory) => {
    onChange(
      selected.includes(cat)
        ? selected.filter((c) => c !== cat)
        : [...selected, cat],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {MISSION_CATEGORIES.map((cat) => {
        const active = selected.includes(cat);
        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            aria-pressed={active}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-semibold",
              "border transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground border-border hover:bg-accent",
            ].join(" ")}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

// ── Active Filter Summary ─────────────────────────────────────────────────────

interface ActiveBadgeProps {
  label: string;
  onRemove: () => void;
}

function ActiveBadge({ label, onRemove }: ActiveBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1",
        "text-xs font-medium rounded-full",
        "bg-primary/10 text-primary border border-primary/20",
      ].join(" ")}
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="hover:text-destructive focus:outline-none"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface MissionQueryBuilderProps {
  /** Called whenever the query changes */
  onChange?: (state: QueryState) => void;
  /** Max reward value for the slider */
  rewardCeiling?: number;
}

export function MissionQueryBuilder({
  onChange,
  rewardCeiling = 10000,
}: MissionQueryBuilderProps) {
  // Initialise from URL on first render
  const [state, setState] = useState<QueryState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    const p = new URLSearchParams(window.location.search);
    return { ...DEFAULT_STATE, ...paramsToState(p) };
  });

  // Sync to URL whenever state changes
  useEffect(() => {
    const params = stateToParams(state);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
    onChange?.(state);
  }, [state, onChange]);

  const patch = useCallback(
    (partial: Partial<QueryState>) =>
      setState((prev) => ({ ...prev, ...partial })),
    [],
  );

  // Filter row helpers
  const addFilter = () =>
    patch({
      filters: [
        ...state.filters,
        { id: uid(), field: "status", operator: "is", value: "" },
      ],
    });

  const updateFilter = (id: string, changes: Partial<FilterRow>) =>
    patch({
      filters: state.filters.map((r) =>
        r.id === id ? { ...r, ...changes } : r,
      ),
    });

  const removeFilter = (id: string) =>
    patch({ filters: state.filters.filter((r) => r.id !== id) });

  const reset = () => setState(DEFAULT_STATE);

  // Active badges summary
  const activeBadges = useMemo(() => {
    const badges: { label: string; onRemove: () => void }[] = [];

    state.filters.forEach((f) => {
      if (f.value)
        badges.push({
          label: `${f.field} ${f.operator} "${f.value}"`,
          onRemove: () => removeFilter(f.id),
        });
    });

    state.categories.forEach((cat) =>
      badges.push({
        label: cat,
        onRemove: () =>
          patch({ categories: state.categories.filter((c) => c !== cat) }),
      }),
    );

    const defaultMin = DEFAULT_STATE.rewardMin;
    const defaultMax = rewardCeiling;
    if (state.rewardMin !== defaultMin || state.rewardMax !== defaultMax)
      badges.push({
        label: `$${state.rewardMin.toLocaleString()} – $${state.rewardMax.toLocaleString()}`,
        onRemove: () => patch({ rewardMin: defaultMin, rewardMax: defaultMax }),
      });

    return badges;
  }, [state, rewardCeiling]);

  const hasAnyFilter = activeBadges.length > 0;

  return (
    <div
      className={[
        "w-full rounded-xl border border-border",
        "bg-card text-card-foreground",
        "shadow-sm overflow-hidden",
      ].join(" ")}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Mission Filters
          </h2>
          {hasAnyFilter && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
              {activeBadges.length}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          disabled={!hasAnyFilter}
          aria-label="Reset all filters"
          className={[
            "inline-flex items-center gap-1.5 text-xs font-medium",
            "px-2.5 py-1.5 rounded-md",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            hasAnyFilter
              ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              : "text-muted-foreground/40 cursor-not-allowed",
          ].join(" ")}
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <div className="p-5 flex flex-col gap-6">
        {/* ── Active filter summary ── */}
        {hasAnyFilter && (
          <div className="flex flex-wrap gap-2">
            {activeBadges.map((b, i) => (
              <ActiveBadge key={i} label={b.label} onRemove={b.onRemove} />
            ))}
          </div>
        )}

        {/* ── Combine Mode ── */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Combine filters
          </label>
          <div className="inline-flex rounded-lg border border-border overflow-hidden w-fit">
            {(["AND", "OR"] as const).map((m) => (
              <button
                key={m}
                onClick={() => patch({ combineMode: m })}
                aria-pressed={state.combineMode === m}
                className={[
                  "px-5 py-2 text-xs font-bold tracking-widest transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring",
                  state.combineMode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                ].join(" ")}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filter rows ── */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Conditions
          </label>

          <div className="flex flex-col gap-2">
            {state.filters.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No conditions yet — add one below.
              </p>
            )}
            {state.filters.map((row, i) => (
              <FilterRowItem
                key={row.id}
                row={row}
                index={i}
                combineMode={state.combineMode}
                isOnly={state.filters.length === 1}
                onChange={updateFilter}
                onRemove={removeFilter}
              />
            ))}
          </div>

          <button
            onClick={addFilter}
            className={[
              "self-start inline-flex items-center gap-1.5 mt-1",
              "px-3 py-1.5 rounded-md text-xs font-medium",
              "border border-dashed border-border text-muted-foreground",
              "hover:border-ring hover:text-foreground hover:bg-muted",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "transition-colors duration-150",
            ].join(" ")}
          >
            <Plus size={13} />
            Add condition
          </button>
        </div>

        {/* ── Reward Range ── */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Reward range
          </label>
          <div className="px-1">
            <RangeSlider
              min={0}
              max={rewardCeiling}
              valueMin={state.rewardMin}
              valueMax={state.rewardMax}
              step={100}
              onChange={(mn, mx) => patch({ rewardMin: mn, rewardMax: mx })}
            />
          </div>
        </div>

        {/* ── Category Multi-select ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Categories
            </label>
            {state.categories.length > 0 && (
              <button
                onClick={() => patch({ categories: [] })}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <CategoryMultiSelect
            selected={state.categories}
            onChange={(cats) => patch({ categories: cats })}
          />
        </div>
      </div>
    </div>
  );
}

export default MissionQueryBuilder;
