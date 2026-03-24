"use client";

import React, { useState, useEffect } from "react";
import { LucideIcon, MoreVertical, RefreshCw } from "lucide-react";

export interface DashboardWidgetProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  animationDelay?: number; // in ms
  animationType?: "fade" | "slide-up" | "scale";
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  subtitle,
  icon: Icon,
  children,
  loading = false,
  error = null,
  onRefresh,
  actions,
  className = "",
  bodyClassName = "",
  animationDelay = 0,
  animationType = "slide-up",
}) => {
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };

  const getAnimationClass = () => {
    if (!mounted) {
      switch (animationType) {
        case "fade":
          return "opacity-0";
        case "slide-up":
          return "opacity-0 translate-y-4";
        case "scale":
          return "opacity-0 scale-95";
        default:
          return "opacity-0";
      }
    }
    return "opacity-100 translate-y-0 scale-100";
  };

  return (
    <div
      className={`
        bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col
        transition-all duration-500 ease-out shadow-sm hover:shadow-md
        ${getAnimationClass()}
        ${className}
      `}
      style={{ transitionDelay: `${animationDelay}ms` }}
    >
      {/* Widget Header */}
      {(title || Icon || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              {title && (
                <h3 className="text-sm font-semibold text-text-primary truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-text-muted truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            {onRefresh && (
              <button
                onClick={handleRefresh}
                className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors ${isRefreshing ? "animate-spin" : ""}`}
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {actions}
            {!actions && !onRefresh && (
              <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Widget Body */}
      <div className={`flex-1 relative ${bodyClassName}`}>
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-medium text-text-muted">
                Loading data...
              </p>
            </div>
          </div>
        )}

        {error ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-3">
              <span className="text-xl font-bold">!</span>
            </div>
            <p className="text-sm font-medium text-text-primary">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 text-xs font-semibold text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default DashboardWidget;
