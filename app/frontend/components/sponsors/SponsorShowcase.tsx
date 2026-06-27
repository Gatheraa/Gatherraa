"use client";

import { useState } from "react";
import type { Sponsor } from "@/lib/types/sponsor";
import { SponsorLogoGrid } from "@/components/sponsors/SponsorLogoGrid";
import { SponsorDetailsModal } from "@/components/sponsors/SponsorDetailsModal";

interface SponsorShowcaseProps {
  sponsors: Sponsor[];
  title?: string;
  subtitle?: string;
}

export function SponsorShowcase({
  sponsors,
  title = "Our sponsors",
  subtitle = "Gatherraa runs on the people and teams who back its missions.",
}: SponsorShowcaseProps) {
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  return (
    <section className="w-full max-w-7xl mx-auto px-6 py-16">
      <div className="mb-10 flex flex-col gap-2 text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {title}
        </h2>
        <p className="text-base text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      </div>

      <SponsorLogoGrid sponsors={sponsors} onSelectSponsor={setSelectedSponsor} />

      <SponsorDetailsModal
        sponsor={selectedSponsor}
        onClose={() => setSelectedSponsor(null)}
      />
    </section>
  );
}