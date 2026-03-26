"use client";

import React, { useMemo } from "react";
import DashboardGrid, { GridItem, type GridColumns } from "./DashboardGrid";
import DashboardWidget, { type DashboardWidgetProps } from "./DashboardWidget";

export type WidgetType = "chart" | "table" | "activity" | "stats" | "custom";

export interface WidgetConfig extends Omit<DashboardWidgetProps, "children"> {
  id: string;
  type: WidgetType;
  component?: React.ReactNode | ((props: any) => React.ReactNode);
  colSpan?:
    | number
    | { default?: number; sm?: number; md?: number; lg?: number; xl?: number };
  rowSpan?: number;
  props?: any;
}

export interface DashboardProps {
  title?: string;
  description?: string;
  widgets: WidgetConfig[];
  gridColumns?: GridColumns;
  className?: string;
  headerActions?: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({
  title,
  description,
  widgets,
  gridColumns = 12,
  className = "",
  headerActions,
}) => {
  const renderedWidgets = useMemo(() => {
    return widgets.map((widget, index) => {
      const { id, type, component, colSpan, rowSpan, props, ...widgetProps } =
        widget;

      const animationDelay = widgetProps.animationDelay ?? index * 100;

      return (
        <GridItem key={id} colSpan={colSpan} rowSpan={rowSpan}>
          <DashboardWidget
            {...widgetProps}
            animationDelay={animationDelay}
            bodyClassName={widgetProps.bodyClassName}
          >
            {typeof component === "function"
              ? (component as Function)(props)
              : component}
            {!component && (
              <div className="p-8 text-center text-text-muted italic opacity-50">
                Placeholder for {type} widget
              </div>
            )}
          </DashboardWidget>
        </GridItem>
      );
    });
  }, [widgets]);

  return (
    <div
      className={`space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ${className}`}
    >
      {(title || description || headerActions) && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <div className="space-y-2">
            {title && (
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium">
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-3">{headerActions}</div>
          )}
        </div>
      )}

      <DashboardGrid columns={gridColumns}>{renderedWidgets}</DashboardGrid>
    </div>
  );
};

export default Dashboard;
