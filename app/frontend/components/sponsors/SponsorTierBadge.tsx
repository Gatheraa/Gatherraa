import { SPONSOR_TIER_META, type SponsorTier } from "@/lib/types/sponsor";

export function SponsorTierBadge({ tier }: { tier: SponsorTier }) {
  const meta = SPONSOR_TIER_META[tier];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.accentClassName}`}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}