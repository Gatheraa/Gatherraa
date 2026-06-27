"use client";

import { useEffect, useRef } from "react";
import type { Sponsor } from "@/lib/types/sponsor";
import { SponsorTierBadge } from "@/components/sponsors/SponsorTierBadge";

interface SponsorDetailsModalProps {
  sponsor: Sponsor | null;
  onClose: () => void;
}

export function SponsorDetailsModal({
  sponsor,
  onClose,
}: SponsorDetailsModalProps) {
  // Note: `animate-in` / `fade-in` / `zoom-in-95` come from the
  // `tailwindcss-animate` plugin. If that plugin isn't installed, these
  // classes are simply no-ops (no animation) — the modal still works fine,
  // just without the entrance transition. Drop them if you'd rather not add
  // the dependency.
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, lock body scroll while open, focus the close button so
  // keyboard users land somewhere sensible inside the dialog.
  useEffect(() => {
    if (!sponsor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sponsor, onClose]);

  if (!sponsor) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-modal-heading"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl motion-safe:animate-in motion-safe:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close sponsor details"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center justify-center rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-900">
          {/* Plain <img>: see note in SponsorLogoGrid about external domains. */}
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className="h-16 w-auto max-w-[200px] object-contain"
          />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="sponsor-modal-heading"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {sponsor.name}
            </h2>
            <SponsorTierBadge tier={sponsor.tier} />
          </div>

          {sponsor.description && (
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {sponsor.description}
            </p>
          )}

          {sponsor.contributionSummary && (
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {sponsor.contributionSummary}
            </p>
          )}

          {sponsor.websiteUrl && (
            <a
              href={sponsor.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full border border-foreground px-5 text-sm font-medium text-foreground transition-colors hover:bg-[#f5f5f5] dark:hover:bg-[#1a1a1a]"
            >
              Visit website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}