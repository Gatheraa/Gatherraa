import React from "react";

interface AnnouncementBadgeProps {
  count: number;
  max?: number;
  className?: string;
  pulse?: boolean;
}

export const AnnouncementBadge: React.FC<AnnouncementBadgeProps> = ({
  count,
  max = 99,
  className = "",
  pulse = true,
}) => {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={`relative inline-flex ${className}`}
      aria-label={`${count} unread announcement${count !== 1 ? "s" : ""}`}
      role="status"
    >
      {pulse && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      )}
      <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full shadow-sm">
        {displayCount}
      </span>
    </span>
  );
};