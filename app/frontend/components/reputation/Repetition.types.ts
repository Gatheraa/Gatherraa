export type ReputationTrend = 'up' | 'down' | 'stable';
export type ReputationTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'elite';
export type ReputationEntityType = 'event' | 'organizer';

export interface ReputationMetric {
  key: string;
  label: string;
  score: number;         // 0–100
  weight: number;        // contribution weight, 0–1, all weights sum to 1
  tooltip: string;
  trend: ReputationTrend;
  trendDelta: number;    // absolute change in score over comparison period
}

export interface ReputationScore {
  entityId: string;
  entityType: ReputationEntityType;
  overallScore: number;          // 0–100
  starRating: number;            // 0–5 (derived)
  tier: ReputationTier;
  trend: ReputationTrend;
  trendDelta: number;            // change vs previous period
  metrics: ReputationMetric[];
  lastUpdated: string;           // ISO date string
  totalReviews: number;
}

// ── Thresholds ──────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<ReputationTier, number> = {
  bronze: 0,
  silver: 40,
  gold: 60,
  platinum: 80,
  elite: 95,
};

export const TIER_LABELS: Record<ReputationTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  elite: 'Elite',
};

export const TIER_COLORS: Record<ReputationTier, { bg: string; text: string; ring: string }> = {
  bronze:   { bg: '#fdf2e9', text: '#92400e', ring: '#d97706' },
  silver:   { bg: '#f1f5f9', text: '#475569', ring: '#94a3b8' },
  gold:     { bg: '#fefce8', text: '#713f12', ring: '#eab308' },
  platinum: { bg: '#eff6ff', text: '#1e3a8a', ring: '#3b82f6' },
  elite:    { bg: '#fdf4ff', text: '#581c87', ring: '#a855f7' },
};

export function deriveTier(score: number): ReputationTier {
  if (score >= TIER_THRESHOLDS.elite)    return 'elite';
  if (score >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (score >= TIER_THRESHOLDS.gold)     return 'gold';
  if (score >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'bronze';
}

export function deriveStarRating(score: number): number {
  return Math.round((score / 100) * 5 * 10) / 10;
}