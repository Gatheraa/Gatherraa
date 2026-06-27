"use client";

import { ReputationMetric } from "./repetition.types";
import { ReputationTooltip } from "./reputationtooltip";
import { TrendIndicator } from "./TrendIndicator";

interface MetricRowProps {
  metric: ReputationMetric;
  animate?: boolean;
  animationDelay?: number;
}

function ScoreBar({ score, animate, delay }: { score: number; animate: boolean; delay: number }) {
  const color =
    score >= 80 ? "#16a34a" :
    score >= 60 ? "#2563eb" :
    score >= 40 ? "#f59e0b" :
    "#dc2626";

  return (
    <div className="metric-bar-track" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="metric-bar-fill"
        style={{
          width: animate ? `${score}%` : "0%",
          backgroundColor: color,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

export function MetricRow({ metric, animate = true, animationDelay = 0 }: MetricRowProps) {
  const scoreColor =
    metric.score >= 80 ? "#16a34a" :
    metric.score >= 60 ? "#2563eb" :
    metric.score >= 40 ? "#f59e0b" :
    "#dc2626";

  return (
    <li className="metric-row">
      <div className="metric-row__header">
        <span className="metric-row__label-wrap">
          <span className="metric-row__label">{metric.label}</span>
          <ReputationTooltip content={metric.tooltip} position="right">
            <span className="metric-info-icon" aria-label="More info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </ReputationTooltip>
        </span>
        <span className="metric-row__right">
          <TrendIndicator trend={metric.trend} delta={metric.trendDelta} size="sm" showLabel={false} />
          <span className="metric-row__score" style={{ color: scoreColor }}>
            {metric.score}
            <span className="metric-row__max">/100</span>
          </span>
        </span>
      </div>
      <ScoreBar score={metric.score} animate={animate} delay={animationDelay} />
      <span className="metric-weight-label">
        {Math.round(metric.weight * 100)}% of total score
      </span>
    </li>
  );
}