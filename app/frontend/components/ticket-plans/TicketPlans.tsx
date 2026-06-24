'use client';

import { useState, useEffect } from 'react';
import { Check, X, Ticket, Users, Clock } from 'lucide-react';
import type { TicketPlansData, TicketPlanTier } from '../../types/ticket-plans';
import { ticketPlansApi } from '../../lib/api/ticket-plans';

interface TicketPlansProps {
  eventId: string;
  onPurchase?: (tier: TicketPlanTier, quantity: number) => void;
}

function TicketPlanCard({
  tier,
  onPurchase,
}: {
  tier: TicketPlanTier;
  onPurchase?: (tier: TicketPlanTier, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const availabilityRatio = tier.total > 0 ? tier.availability / tier.total : 0;
  const lowAvailability = tier.availability > 0 && tier.availability <= tier.total * 0.2;
  const soldOut = tier.availability === 0;

  const handlePurchase = () => {
    onPurchase?.(tier, quantity);
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-800 ${
        tier.highlighted
          ? 'border-blue-500 shadow-blue-100 dark:border-blue-400 dark:shadow-blue-900/30 scale-[1.02]'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
            {tier.badge}
          </span>
        </div>
      )}

      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tier.name}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tier.description}</p>
      </div>

      <div className="mb-6 text-center">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">
          ${tier.price.toFixed(2)}
        </span>
        <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">/{tier.period}</span>
      </div>

      <div className="mb-6 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          What's included
        </h4>
        <ul className="space-y-2">
          {tier.benefits.map((benefit, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="mt-0.5 shrink-0 text-green-500">
                <Check className="h-4 w-4" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      {tier.availability > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {tier.availability} remaining
            </span>
            <span>{Math.round(availabilityRatio * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all ${
                lowAvailability ? 'bg-orange-500' : 'bg-blue-500'
              }`}
              style={{ width: `${availabilityRatio * 100}%` }}
            />
          </div>
        </div>
      )}

      {lowAvailability && !soldOut && (
        <div className="mb-4 flex items-center justify-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          <Clock className="h-3 w-3" />
          Only {tier.availability} tickets left
        </div>
      )}

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="flex h-8 w-12 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handlePurchase}
          disabled={soldOut}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all ${
            tier.highlighted
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-[0.98]'
              : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/30'
          } disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100`}
        >
          {soldOut ? (
            <>
              <X className="h-4 w-4" />
              Sold Out
            </>
          ) : (
            <>
              <Ticket className="h-4 w-4" />
              {tier.highlighted ? 'Get Started' : 'Choose Plan'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 space-y-3 text-center">
        <div className="mx-auto h-5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mx-auto h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mb-6 text-center">
        <div className="mx-auto h-10 w-32 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mb-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <div className="h-12 w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function ComparisonTable({ tiers }: { tiers: TicketPlanTier[] }) {
  const allBenefits = Array.from(new Set(tiers.flatMap((t) => t.benefits))).sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Feature</th>
            {tiers.map((tier) => (
              <th
                key={tier.id}
                className={`p-3 text-center font-bold ${
                  tier.highlighted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                }`}
              >
                <div>{tier.name}</div>
                <div className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                  ${tier.price.toFixed(2)}/{tier.period}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {allBenefits.map((benefit, i) => (
            <tr key={i} className="even:bg-gray-50 dark:even:bg-gray-800/50">
              <td className="p-3 text-gray-700 dark:text-gray-300">{benefit}</td>
              {tiers.map((tier) => (
                <td key={tier.id} className="p-3 text-center">
                  {tier.benefits.includes(benefit) ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-green-100 p-1 dark:bg-green-900/30">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-full bg-gray-100 p-1 dark:bg-gray-700">
                      <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TicketPlans({ eventId, onPurchase }: TicketPlansProps) {
  const [data, setData] = useState<TicketPlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const plans = await ticketPlansApi.getPlans(eventId);
        setData(plans);
      } catch {
        setError('Failed to load ticket plans');
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, [eventId]);

  if (loading) {
    return (
      <section className="mb-6">
        <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Choose Your Ticket</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null;
  }

  const { tiers } = data;

  return (
    <section className="mb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Choose Your Ticket</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select the plan that works best for you
          </p>
        </div>
        {tiers.length > 1 && (
          <button
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="hidden whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:inline-flex dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {showComparison ? 'Card View' : 'Compare Tiers'}
          </button>
        )}
      </div>

      {showComparison && tiers.length > 1 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <ComparisonTable tiers={tiers} />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => onPurchase?.(tier, 1)}
                disabled={tier.availability === 0}
                className={`rounded-xl py-3 text-center text-sm font-bold transition-all ${
                  tier.highlighted
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                    : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/30'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {tier.availability === 0 ? 'Sold Out' : `Buy ${tier.name}`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiers.map((tier) => (
            <TicketPlanCard key={tier.id} tier={tier} onPurchase={onPurchase} />
          ))}
        </div>
      )}
    </section>
  );
}
