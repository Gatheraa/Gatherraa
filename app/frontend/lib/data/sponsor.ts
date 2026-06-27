import type { Sponsor } from "@/lib/types/sponsor";

/**
 * Placeholder sponsor list.
 *
 * Swap this for a real data source (CMS, API route, or on-chain registry)
 * once one exists — `SponsorShowcase` only depends on the `Sponsor[]` shape,
 * not on where the data comes from.
 */
export const sponsors: Sponsor[] = [
  {
    id: "stellar-foundation",
    name: "Stellar Development Foundation",
    tier: "platinum",
    logoUrl: "/sponsors/stellar-foundation.svg",
    websiteUrl: "https://stellar.org",
    description:
      "Backs the core infrastructure that lets Gatherraa settle event contributions on-chain.",
    contributionSummary: "Lead sponsor since launch",
  },
  {
    id: "novahost",
    name: "NovaHost",
    tier: "gold",
    logoUrl: "/sponsors/novahost.svg",
    websiteUrl: "https://example.com/novahost",
    description: "Provides venue and streaming infrastructure for flagship events.",
    contributionSummary: "Hosted 6 events this year",
  },
  {
    id: "ledgerline",
    name: "Ledgerline",
    tier: "gold",
    logoUrl: "/sponsors/ledgerline.svg",
    websiteUrl: "https://example.com/ledgerline",
    description: "Wallet infrastructure partner powering in-app payouts.",
  },
  {
    id: "trailmark-coop",
    name: "Trailmark Co-op",
    tier: "silver",
    logoUrl: "/sponsors/trailmark.svg",
    websiteUrl: "https://example.com/trailmark",
    description: "Community grants for first-time mission organizers.",
  },
  {
    id: "fieldcraft",
    name: "Fieldcraft Studio",
    tier: "silver",
    logoUrl: "/sponsors/fieldcraft.svg",
    description: "Design partner for event branding kits.",
  },
  {
    id: "loop-collective",
    name: "Loop Collective",
    tier: "community",
    logoUrl: "/sponsors/loop-collective.svg",
    websiteUrl: "https://example.com/loop",
  },
  {
    id: "basecamp-builders",
    name: "Basecamp Builders",
    tier: "community",
    logoUrl: "/sponsors/basecamp-builders.svg",
  },
];