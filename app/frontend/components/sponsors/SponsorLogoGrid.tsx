"use client";

import {
  SPONSOR_TIER_META,
  groupSponsorsByTier,
  type Sponsor,
} from "@/lib/types/sponsor";

interface SponsorLogoGridProps {
  sponsors: Sponsor[];
  onSelectSponsor: (sponsor: Sponsor) => void;
}

export function SponsorLogoGrid({
  sponsors,
  onSelectSponsor,
}: SponsorLogoGridProps) {
  const groups = groupSponsorsByTier(sponsors);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No sponsors to show yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {groups.map(({ tier, sponsors: tierSponsors }) => {
        const meta = SPONSOR_TIER_META[tier];
        return (
          <section key={tier} aria-labelledby={`tier-${tier}-heading`}>
            <div className="mb-4 flex items-center gap-3">
              <h3
                id={`tier-${tier}-heading`}
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                {meta.label}
              </h3>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <ul className="flex flex-wrap items-center gap-3">
              {tierSponsors.map((sponsor) => (
                <li key={sponsor.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSponsor(sponsor)}
                    aria-haspopup="dialog"
                    className="group flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                  >
                    {/*
                      Plain <img> on purpose: sponsor logos can come from
                      arbitrary external hosts, so next/image would need every
                      domain added to next.config's remotePatterns first.
                      Swap to next/image once logos are served from a known,
                      configured origin.
                    */}
                    <img
                      src={sponsor.logoUrl}
                      alt={sponsor.name}
                      style={{ height: meta.logoHeight }}
                      className="w-auto max-w-[160px] object-contain opacity-80 grayscale transition-[opacity,filter] group-hover:opacity-100 group-hover:grayscale-0"
                    />
                    <span className="sr-only">View details for {sponsor.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}