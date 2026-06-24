"use client";

import { ReputationTrend } from "./repetition.types";
import { ReputationTooltip } from "./reputationtooltip";


interface TrendIndicatorProps {
  trend: ReputationTrend;
  delta: number;
  period?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { icon: 14, text: "trend-text-sm" },
  md: { icon: 18, text: "trend-text-md" },
  lg: { icon: 22, text: "trend-text-lg" },
};

export function TrendIndicator({
  trend,
  delta,
  period = "last 30 days",
  size = "md",
  showLabel = true,
}: TrendIndicatorProps) {
  const { icon, text } = SIZE_MAP[size];
  const absD = Math.abs(delta).toFixed(1);

  const config = {
    up: {
      color: "#16a34a",
      bg: "#dcfce7",
      label: `+${absD} pts`,
      ariaLabel: `Trending up ${absD} points`,
      icon: (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    down: {
      color: "#dc2626",
      bg: "#fee2e2",
      label: `−${absD} pts`,
      ariaLabel: `Trending down ${absD} points`,
      icon: (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 7L17 17M17 17H7M17 17V7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    stable: {
      color: "#6b7280",
      bg: "#f3f4f6",
      label: "No change",
      ariaLabel: "Score stable",
      icon: (
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
    },
  }[trend];

  const tooltipText =
    trend === "stable"
      ? `Score unchanged over ${period}.`
      : `Score ${trend === "up" ? "increased" : "decreased"} by ${absD} points over ${period}.`;

  return (
    <ReputationTooltip content={tooltipText}>
      <span
        className={`trend-indicator trend-indicator--${trend} trend-indicator--${size}`}
        aria-label={config.ariaLabel}
        style={{ "--trend-color": config.color, "--trend-bg": config.bg } as React.CSSProperties}
      >
        <span className="trend-icon">{config.icon}</span>
        {showLabel && <span className={`trend-label ${text}`}>{config.label}</span>}
      </span>
    </ReputationTooltip>
  );
}