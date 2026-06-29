"use client";

import { RevenueCards, type RevenueCardData, DEFAULT_CARDS } from "./RevenueCards";
import { TicketSalesTrend, type SalesDataPoint } from "./TicketSalesTrend";
import { ExportButton, type ExportFormat } from "./ExportButton";

export interface OrganizerRevenueTrackerProps {
  eventName?: string;
  cards?: RevenueCardData[];
  salesData?: SalesDataPoint[];
  onExport?: (format: ExportFormat) => Promise<void> | void;
  className?: string;
}

export function OrganizerRevenueTracker({
  eventName = "All Events",
  cards = DEFAULT_CARDS,
  salesData,
  onExport,
  className = "",
}: OrganizerRevenueTrackerProps) {
  return (
    <section className={`space-y-6 ${className}`} aria-label="Revenue Tracker">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            Revenue Overview
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{eventName}</p>
        </div>
        <ExportButton onExport={onExport} />
      </div>

      {/* Revenue Cards */}
      <RevenueCards cards={cards} />

      {/* Ticket Sales Trend Chart */}
      <TicketSalesTrend data={salesData} />
    </section>
  );
}

export default OrganizerRevenueTracker;
