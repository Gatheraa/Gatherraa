"use client";

import React from "react";
import {
  LucideIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Star,
  MessageSquare,
  CreditCard,
} from "lucide-react";

export interface ActivityItem {
  id: string;
  type:
    | "success"
    | "warning"
    | "error"
    | "info"
    | "message"
    | "star"
    | "payment";
  title: string;
  description?: string;
  timestamp: string | number;
  icon?: LucideIcon;
  metadata?: React.ReactNode;
}

export interface ActivityPanelProps {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

const ActivityPanel: React.FC<ActivityPanelProps> = ({
  items,
  emptyMessage = "No recent activity found.",
  className = "",
}) => {
  const getIcon = (type: ActivityItem["type"], CustomIcon?: LucideIcon) => {
    if (CustomIcon) return CustomIcon;
    switch (type) {
      case "success":
        return CheckCircle;
      case "warning":
        return AlertCircle;
      case "error":
        return AlertCircle;
      case "info":
        return Info;
      case "star":
        return Star;
      case "message":
        return MessageSquare;
      case "payment":
        return CreditCard;
      default:
        return Info;
    }
  };

  const getColorClass = (type: ActivityItem["type"]) => {
    switch (type) {
      case "success":
        return "text-success bg-success/10 bg-success/20";
      case "warning":
        return "text-warning bg-warning/10";
      case "error":
        return "text-error bg-error/10";
      case "info":
        return "text-primary bg-primary/10";
      case "star":
        return "text-warning bg-warning/10";
      case "message":
        return "text-info bg-info/10";
      case "payment":
        return "text-success bg-success/10";
      default:
        return "text-primary bg-primary/10";
    }
  };

  const formatTimestamp = (ts: string | number) => {
    if (typeof ts === "number") {
      const diff = Math.floor((Date.now() - ts) / 60000); // mins
      if (diff < 1) return "Just now";
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return `${Math.floor(diff / 1440)}d ago`;
    }
    return ts;
  };

  return (
    <div className={`flex flex-col h-full bg-transparent ${className}`}>
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-70">
          <Clock className="w-10 h-10 text-zinc-400 mb-3" />
          <p className="text-sm font-medium text-zinc-500">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 overflow-auto scrollbar-thin">
          {items.map((item) => {
            const Icon = getIcon(item.type, item.icon);
            return (
              <div
                key={item.id}
                className="group flex gap-4 px-5 py-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer"
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getColorClass(item.type)}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate transition-colors group-hover:text-primary">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-medium text-zinc-500 whitespace-nowrap ml-2">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-2">
                      {item.description}
                    </p>
                  )}

                  {item.metadata && (
                    <div className="flex flex-wrap gap-2">{item.metadata}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityPanel;
