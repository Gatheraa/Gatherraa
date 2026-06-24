"use client";

import { useState, useEffect } from "react";

import { TrendIndicator } from "./TrendIndicator";
import { StarRating } from "./StarRating";
import "./reputation.css";
import { ReputationTooltip } from "./reputationtooltip";
import { MetricRow } from "./MetriCrow";
import { ReputationEntityType, ReputationScore, TIER_COLORS, TIER_LABELS } from "./repetition.types";

interface ReputationScoreCardProps {
  data: ReputationScore;
  showBreakdown?: boolean;
  compact?: boolean;
  className?: string;
}

const ENTITY_LABELS: Record<ReputationEntityType, string> = {
  event: "Event Score",
  organizer: "Organizer Score",
};

export function ReputationScoreCard({
  data,
  showBreakdown = true,
  compact = false,
  className = "",
}: ReputationScoreCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(showBreakdown);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const tierMeta = TIER_COLORS[data.tier];
  const tierLabel = TIER_LABELS[data.tier];

  const scoreAngle = (data.overallScore / 100) * 251.2; // circumference of r=40

  return (
    <article
      className={`reputation-card ${compact ? "reputation-card--compact" : ""} ${className}`}
      aria-label={`Reputation score for ${data.entityType}`}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="reputation-card__header">
        <div className="reputation-card__title-row">
          <span className="reputation-card__entity-label">
            {ENTITY_LABELS[data.entityType]}
          </span>
          <ReputationTooltip
            content={`${tierLabel} tier — awarded to ${
              data.entityType === "organizer" ? "organizers" : "events"
            } scoring ${data.overallScore} or above. Tier is recalculated monthly.`}
          >
            <span
              className="reputation-tier-badge"
              style={{
                background: tierMeta.bg,
                color: tierMeta.text,
                boxShadow: `0 0 0 1.5px ${tierMeta.ring}`,
              }}
            >
              {tierLabel}
            </span>
          </ReputationTooltip>
        </div>
      </header>

      {/* ── Score + gauge ────────────────────────────────────────────── */}
      <div className="reputation-card__body">
        <div className="reputation-gauge" aria-hidden>
          <svg viewBox="0 0 100 100" className="reputation-gauge__svg">
            {/* Track */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Fill */}
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={tierMeta.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset={animated ? 251.2 - scoreAngle : 251.2}
              transform="rotate(-90 50 50)"
              className="reputation-gauge__fill"
            />
          </svg>
          <div className="reputation-gauge__center">
            <span className="reputation-gauge__score">{data.overallScore}</span>
            <span className="reputation-gauge__denom">/100</span>
          </div>
        </div>

        <div className="reputation-card__meta">
          <StarRating rating={data.starRating} size={20} />
          <TrendIndicator
            trend={data.trend}
            delta={data.trendDelta}
            size="md"
          />
          <div className="reputation-card__reviews">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{data.totalReviews.toLocaleString()} reviews</span>
          </div>
          <time className="reputation-card__updated" dateTime={data.lastUpdated}>
            Updated {new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </time>
        </div>
      </div>

      {/* ── Breakdown toggle ─────────────────────────────────────────── */}
      {!compact && (
        <div className="reputation-card__breakdown-section">
          <button
            className="reputation-card__breakdown-toggle"
            onClick={() => setBreakdownOpen(o => !o)}
            aria-expanded={breakdownOpen}
            aria-controls="reputation-breakdown"
          >
            <span>Score breakdown</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              aria-hidden
              style={{ transform: breakdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {breakdownOpen && (
            <ul id="reputation-breakdown" className="reputation-metrics-list" role="list">
              {data.metrics.map((metric, i) => (
                <MetricRow
                  key={metric.key}
                  metric={metric}
                  animate={animated}
                  animationDelay={i * 80}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}