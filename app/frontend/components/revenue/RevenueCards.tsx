"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Ticket,
  TrendingDown,
  TrendingUp,
  Wallet,
  Tag,
} from "lucide-react";

export interface RevenueCardData {
  id: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  change: number;
  changeLabel?: string;
  icon: React.ElementType;
  accent: "blue" | "green" | "amber" | "violet";
}

const ACCENT: Record<
  RevenueCardData["accent"],
  { icon: string; badge: string; text: string }
> = {
  blue: {
    icon: "bg-blue-500/10 text-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    icon: "bg-emerald-500/10 text-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-500",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
  },
};

function useAnimatedCount(target: number, decimals: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf: number;
    let start: number;
    const from = 0;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, ready]);

  return display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function RevenueCard({ card }: { card: RevenueCardData }) {
  const formatted = useAnimatedCount(card.value, card.decimals ?? 0);
  const accent = ACCENT[card.accent];
  const Icon = card.icon;
  const up = card.change >= 0;

  return (
    <div className="bg-surface rounded-xl border border-border-default p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/20 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${accent.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            up
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {up ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {Math.abs(card.change).toFixed(1)}%
        </div>
      </div>

      <div>
        <p className="text-sm text-text-muted font-medium mb-1">{card.label}</p>
        <p className={`text-2xl font-bold tabular-nums ${accent.text}`}>
          {card.prefix}
          {formatted}
          {card.suffix}
        </p>
        {card.changeLabel && (
          <p className="text-xs text-text-muted mt-1.5">{card.changeLabel}</p>
        )}
      </div>
    </div>
  );
}

const DEFAULT_CARDS: RevenueCardData[] = [
  {
    id: "total-revenue",
    label: "Total Revenue",
    value: 48250,
    prefix: "$",
    decimals: 0,
    change: 14.2,
    changeLabel: "vs. last month",
    icon: DollarSign,
    accent: "blue",
  },
  {
    id: "tickets-sold",
    label: "Tickets Sold",
    value: 1342,
    decimals: 0,
    change: 9.7,
    changeLabel: "vs. last month",
    icon: Ticket,
    accent: "green",
  },
  {
    id: "avg-ticket",
    label: "Avg. Ticket Price",
    value: 35.95,
    prefix: "$",
    decimals: 2,
    change: 4.1,
    changeLabel: "vs. last month",
    icon: Tag,
    accent: "amber",
  },
  {
    id: "net-payout",
    label: "Net Payout",
    value: 42865,
    prefix: "$",
    decimals: 0,
    change: -2.3,
    changeLabel: "after platform fees",
    icon: Wallet,
    accent: "violet",
  },
];

export interface RevenueCardsProps {
  cards?: RevenueCardData[];
  className?: string;
}

export function RevenueCards({
  cards = DEFAULT_CARDS,
  className = "",
}: RevenueCardsProps) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 ${className}`}
    >
      {cards.map((card) => (
        <RevenueCard key={card.id} card={card} />
      ))}
    </div>
  );
}

export { DEFAULT_CARDS };
export default RevenueCards;
