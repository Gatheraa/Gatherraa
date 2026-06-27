export type SponsorTier = "platinum" | "gold" | "silver" | "community";

export interface Sponsor {
  id: string;
  name: string;
  tier: SponsorTier;
  logoUrl: string;
  websiteUrl?: string;
  description?: string;
  /** Short, human-readable line about what this sponsor has backed, e.g. "Backed 4 missions in Q2". */
  contributionSummary?: string;
}

/** Display order for tiers, highest commitment first. */
export const SPONSOR_TIER_ORDER: SponsorTier[] = [
  "platinum",
  "gold",
  "silver",
  "community",
];

interface SponsorTierMeta {
  label: string;
  /** Logo height in px used in the grid; conveys tier weight without extra copy. */
  logoHeight: number;
  /** Small accent dot color used on the tier badge. Kept restrained on purpose. */
  accentClassName: string;
}

export const SPONSOR_TIER_META: Record<SponsorTier, SponsorTierMeta> = {
  platinum: {
    label: "Platinum",
    logoHeight: 64,
    accentClassName: "bg-zinc-400 dark:bg-zinc-300",
  },
  gold: {
    label: "Gold",
    logoHeight: 52,
    accentClassName: "bg-amber-500",
  },
  silver: {
    label: "Silver",
    logoHeight: 42,
    accentClassName: "bg-zinc-400/70 dark:bg-zinc-500",
  },
  community: {
    label: "Community Partners",
    logoHeight: 32,
    accentClassName: "bg-sky-500",
  },
};

/** Groups a flat sponsor list into tier buckets, in display order, skipping empty tiers. */
export function groupSponsorsByTier(
  sponsors: Sponsor[]
): { tier: SponsorTier; sponsors: Sponsor[] }[] {
  return SPONSOR_TIER_ORDER.map((tier) => ({
    tier,
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.sponsors.length > 0);
}