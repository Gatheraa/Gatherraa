'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Star, Info, Award, Users, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReputationMetrics {
  /** Attendance score (0-100) */
  attendance: number;
  /** Feedback score (0-100) */
  feedback: number;
  /** Reliability score (0-100) */
  reliability: number;
}

export interface EventReputationScoreProps {
  /** Overall reputation score (0-100) */
  score: number;
  /** Breakdown metrics */
  metrics: ReputationMetrics;
  /** Previous score for trend calculation */
  previousScore?: number;
  /** Whether to show star-based display instead of numeric */
  starBased?: boolean;
  /** Additional className */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Average';
  if (score >= 20) return 'Poor';
  return 'Very Poor';
}

function getStars(score: number): number {
  return Math.round(score / 20);
}

function getTrend(current: number, previous?: number): { direction: 'up' | 'down' | 'stable'; diff: number } {
  if (previous === undefined) return { direction: 'stable', diff: 0 };
  const diff = current - previous;
  if (diff > 2) return { direction: 'up', diff };
  if (diff < -2) return { direction: 'down', diff };
  return { direction: 'stable', diff };
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap z-20">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

// ─── MetricBar ────────────────────────────────────────────────────────────────

interface MetricBarProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

function MetricBar({ label, value, icon: Icon, description }: MetricBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          <Tooltip text={description} />
        </div>
        <span className={`text-sm font-semibold ${getScoreColor(value)}`}>{value}/100</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreBg(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${value} out of 100`}
        />
      </div>
    </div>
  );
}

// ─── StarDisplay ──────────────────────────────────────────────────────────────

function StarDisplay({ score }: { score: number }) {
  const stars = getStars(score);
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${stars} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-6 h-6 ${
            i <= stars
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

// ─── TrendIndicator ───────────────────────────────────────────────────────────

function TrendIndicator({ current, previous }: { current: number; previous?: number }) {
  const trend = getTrend(current, previous);

  if (trend.direction === 'stable') {
    return (
      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
        <Minus className="w-4 h-4" />
        <span className="text-xs font-medium">Stable</span>
      </div>
    );
  }

  const isUp = trend.direction === 'up';
  return (
    <div className={`flex items-center gap-1 ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span className="text-xs font-medium">
        {isUp ? '+' : ''}{trend.diff.toFixed(1)} pts
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EventReputationScore({
  score,
  metrics,
  previousScore,
  starBased = false,
  className = '',
}: EventReputationScoreProps) {
  const clampedScore = Math.min(100, Math.max(0, score));

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className={`w-5 h-5 ${getScoreColor(clampedScore)}`} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reputation Score
          </h3>
        </div>
        <TrendIndicator current={clampedScore} previous={previousScore} />
      </div>

      {/* Score Display */}
      <div className="flex items-center gap-6 mb-6">
        {starBased ? (
          <div className="flex flex-col items-center gap-1">
            <StarDisplay score={clampedScore} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getStars(clampedScore)}/5 stars
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${getScoreColor(clampedScore)}`}>
              {clampedScore}
            </span>
            <span className="text-lg text-gray-400 dark:text-gray-500">/100</span>
          </div>
        )}
        <div className="flex flex-col">
          <span className={`text-sm font-semibold ${getScoreColor(clampedScore)}`}>
            {getScoreLabel(clampedScore)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Based on {metrics.attendance + metrics.feedback + metrics.reliability > 0 ? '3 metrics' : 'limited data'}
          </span>
        </div>
      </div>

      {/* Score Ring / Progress */}
      {!starBased && (
        <div className="mb-6">
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${getScoreBg(clampedScore)}`}
              style={{ width: `${clampedScore}%` }}
              role="progressbar"
              aria-valuenow={clampedScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reputation score: ${clampedScore} out of 100`}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">0</span>
            <span className="text-[10px] text-gray-400">50</span>
            <span className="text-[10px] text-gray-400">100</span>
          </div>
        </div>
      )}

      {/* Breakdown Metrics */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Breakdown
        </h4>
        <MetricBar
          label="Attendance"
          value={metrics.attendance}
          icon={Users}
          description="Based on event attendance rates and consistency"
        />
        <MetricBar
          label="Feedback"
          value={metrics.feedback}
          icon={MessageSquare}
          description="Based on attendee reviews and ratings"
        />
        <MetricBar
          label="Reliability"
          value={metrics.reliability}
          icon={Award}
          description="Based on event completion and cancellation history"
        />
      </div>
    </div>
  );
}

export default EventReputationScore;
