'use client';

import React, { useState, useEffect, useMemo, useCallback, type ReactElement } from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface AnalyticsCardData {
  id: string;
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}

export interface AnalyticsCardGridProps {
  cards: AnalyticsCardData[];
  columns?: 1 | 2 | 3 | 4;
  animateOnLoad?: boolean;
  animationDuration?: number;
  hoverEffect?: boolean;
  onCardClick?: (card: AnalyticsCardData) => void;
  className?: string;
}

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}

function AnimatedCounter({ value, prefix = '', suffix = '', duration = 1500, decimals = 0 }: AnimatedCounterProps): ReactElement {
  const [displayValue, setDisplayValue] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let startTime: number;
    let animationFrame: number;
    const startValue = displayValue;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * easeOut;
      
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration, mounted]);

  const formattedValue = useMemo(() => {
    return displayValue.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [displayValue, decimals]);

  if (!mounted) {
    return <span className="text-3xl font-bold">0</span>;
  }

  return (
    <span className="text-3xl font-bold tabular-nums">
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

interface AnalyticsCardProps {
  card: AnalyticsCardData;
  onClick?: () => void;
  hoverEffect?: boolean;
}

function AnalyticsCard({ card, onClick, hoverEffect = true }: AnalyticsCardProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  const Icon = card.icon;

  const colorClasses = useMemo(() => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      primary: {
        bg: 'bg-primary/10',
        text: 'text-primary',
        icon: 'bg-primary/20',
      },
      success: {
        bg: 'bg-success/10',
        text: 'text-success',
        icon: 'bg-success/20',
      },
      warning: {
        bg: 'bg-warning/10',
        text: 'text-warning',
        icon: 'bg-warning/20',
      },
      error: {
        bg: 'bg-error/10',
        text: 'text-error',
        icon: 'bg-error/20',
      },
      info: {
        bg: 'bg-info/10',
        text: 'text-info',
        icon: 'bg-info/20',
      },
    };
    return colors[card.color || 'primary'];
  }, [card.color]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }, [onClick]);

  return (
    <div
      className={`
        bg-surface rounded-xl border border-border-default p-5
        transition-all duration-300 ease-out
        ${hoverEffect ? 'hover:shadow-lg hover:border-primary/30 cursor-pointer' : ''}
        ${isHovered && hoverEffect ? 'transform scale-[1.02]' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      aria-label={`${card.title}: ${card.value}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${colorClasses.icon}`}>
          <Icon className={`w-5 h-5 ${colorClasses.text}`} />
        </div>
        {card.change !== undefined && (
          <div
            className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${card.change > 0 ? 'bg-success/10 text-success' : card.change < 0 ? 'bg-error/10 text-error' : 'bg-gray-100 text-text-muted'}
            `}
          >
            {card.change > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : card.change < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span>{Math.abs(card.change)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm text-text-muted font-medium">{card.title}</p>
        <div className={`${colorClasses.text} transition-all duration-300`}>
          <AnimatedCounter
            value={card.value}
            prefix={card.prefix}
            suffix={card.suffix}
          />
        </div>
        {card.changeLabel && (
          <p className="text-xs text-text-muted mt-2">{card.changeLabel}</p>
        )}
      </div>
    </div>
  );
}

export function AnalyticsCardGrid({
  cards,
  columns = 4,
  animateOnLoad = true,
  animationDuration = 1500,
  hoverEffect = true,
  onCardClick,
  className = '',
}: AnalyticsCardGridProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState(animateOnLoad);

  useEffect(() => {
    setMounted(true);
    if (animateOnLoad) {
      const timer = setTimeout(() => setIsAnimating(false), animationDuration);
      return () => clearTimeout(timer);
    }
  }, [animateOnLoad, animationDuration]);

  const gridColsClass = useMemo(() => {
    const cols: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    };
    return cols[columns];
  }, [columns]);

  const handleCardClick = useCallback((card: AnalyticsCardData) => {
    onCardClick?.(card);
  }, [onCardClick]);

  if (!mounted) {
    return (
      <div className={`grid ${gridColsClass} gap-4 ${className}`}>
        {cards.map((card) => (
          <div
            key={card.id}
            className="bg-surface rounded-xl border border-border-default p-5 animate-pulse"
          >
            <div className="h-10 w-10 bg-gray-200 rounded-lg mb-4" />
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-32 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridColsClass} gap-4 ${className}`}>
      {cards.map((card, index) => (
        <div
          key={card.id}
          className={`transition-all duration-500 ${
            isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
          style={{
            transitionDelay: isAnimating ? `${index * 100}ms` : '0ms',
          }}
        >
          <AnalyticsCard
            card={card}
            onClick={() => handleCardClick(card)}
            hoverEffect={hoverEffect}
          />
        </div>
      ))}
    </div>
  );
}

export default AnalyticsCardGrid;
