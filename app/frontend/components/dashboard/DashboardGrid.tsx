"use client";

import React, { useMemo } from "react";

export type GridColumns = 1 | 2 | 3 | 4 | 6 | 12;

export interface DashboardGridProps {
  children: React.ReactNode;
  columns?: GridColumns;
  gap?: 4 | 6 | 8;
  className?: string;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = 12,
  gap = 6,
  className = "",
}) => {
  const gapClass = useMemo(() => {
    switch (gap) {
      case 4:
        return "gap-4";
      case 6:
        return "gap-6";
      case 8:
        return "gap-8";
      default:
        return "gap-6";
    }
  }, [gap]);

  return (
    <div className={`grid grid-cols-12 ${gapClass} ${className}`}>
      {children}
    </div>
  );
};

export interface GridItemProps {
  children: React.ReactNode;
  colSpan?:
    | number
    | {
        default?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
      };
  rowSpan?: number;
  className?: string;
}

export function GridItem({
  children,
  colSpan = 12,
  rowSpan = 1,
  className = "",
}: GridItemProps) {
  const getColSpanClasses = useMemo(() => {
    const defaultSpan = typeof colSpan === "number" ? colSpan : (colSpan.default || 12);
    
    // Explicit mappings for Tailwind v4
    const spanMap: Record<number, string> = {
      1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4",
      5: "col-span-5", 6: "col-span-6", 7: "col-span-7", 8: "col-span-8",
      9: "col-span-9", 10: "col-span-10", 11: "col-span-11", 12: "col-span-12"
    };
    const smSpanMap: Record<number, string> = {
      1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4",
      5: "sm:col-span-5", 6: "sm:col-span-6", 7: "sm:col-span-7", 8: "sm:col-span-8",
      9: "sm:col-span-9", 10: "sm:col-span-10", 11: "sm:col-span-11", 12: "sm:col-span-12"
    };
    const mdSpanMap: Record<number, string> = {
      1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4",
      5: "md:col-span-5", 6: "md:col-span-6", 7: "md:col-span-7", 8: "md:col-span-8",
      9: "md:col-span-9", 10: "md:col-span-10", 11: "md:col-span-11", 12: "md:col-span-12"
    };
    const lgSpanMap: Record<number, string> = {
      1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4",
      5: "lg:col-span-5", 6: "lg:col-span-6", 7: "lg:col-span-7", 8: "lg:col-span-8",
      9: "lg:col-span-9", 10: "lg:col-span-10", 11: "lg:col-span-11", 12: "lg:col-span-12"
    };
    const xlSpanMap: Record<number, string> = {
      1: "xl:col-span-1", 2: "xl:col-span-2", 3: "xl:col-span-3", 4: "xl:col-span-4",
      5: "xl:col-span-5", 6: "xl:col-span-6", 7: "xl:col-span-7", 8: "xl:col-span-8",
      9: "xl:col-span-9", 10: "xl:col-span-10", 11: "xl:col-span-11", 12: "xl:col-span-12"
    };

    let classes = spanMap[defaultSpan];

    if (typeof colSpan === "object") {
      if (colSpan.sm) classes += " " + smSpanMap[colSpan.sm];
      if (colSpan.md) classes += " " + mdSpanMap[colSpan.md];
      if (colSpan.lg) classes += " " + lgSpanMap[colSpan.lg];
      if (colSpan.xl) classes += " " + xlSpanMap[colSpan.xl];
    }

    return classes;
  }, [colSpan]);

  const rowMap: Record<number, string> = {
    1: "row-span-1", 2: "row-span-2", 3: "row-span-3", 4: "row-span-4",
    5: "row-span-5", 6: "row-span-6"
  };
  const rowSpanClass = rowSpan > 1 ? rowMap[rowSpan] || "" : "";

  return (
    <div className={`${getColSpanClasses} ${rowSpanClass} ${className}`}>
      {children}
    </div>
  );
}

export default DashboardGrid;
