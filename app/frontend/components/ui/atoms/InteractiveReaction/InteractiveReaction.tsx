'use client';

import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { Heart, ThumbsUp, MessageCircle, Share2, Bookmark } from 'lucide-react';

export type ReactionType = 'like' | 'love' | 'thumbsup' | 'comment' | 'share' | 'bookmark';

export interface InteractiveReactionProps {
  reactionType: ReactionType;
  count: number;
  onReact?: (reactionType: ReactionType, isActive: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  disabled?: boolean;
  className?: string;
  isActive?: boolean;
}

interface ReactionConfig {
  icon: React.ReactNode;
  activeColor: string;
  hoverColor: string;
  animationClass: string;
}

const reactionConfigs: Record<ReactionType, ReactionConfig> = {
  like: {
    icon: <Heart className="w-4 h-4" />,
    activeColor: 'text-red-500',
    hoverColor: 'hover:text-red-400',
    animationClass: 'animate-heart-beat',
  },
  love: {
    icon: <Heart className="w-4 h-4 fill-current" />,
    activeColor: 'text-pink-500',
    hoverColor: 'hover:text-pink-400',
    animationClass: 'animate-heart-beat',
  },
  thumbsup: {
    icon: <ThumbsUp className="w-4 h-4" />,
    activeColor: 'text-blue-500',
    hoverColor: 'hover:text-blue-400',
    animationClass: 'animate-bounce-in',
  },
  comment: {
    icon: <MessageCircle className="w-4 h-4" />,
    activeColor: 'text-green-500',
    hoverColor: 'hover:text-green-400',
    animationClass: 'animate-pulse-in',
  },
  share: {
    icon: <Share2 className="w-4 h-4" />,
    activeColor: 'text-purple-500',
    hoverColor: 'hover:text-purple-400',
    animationClass: 'animate-spin-in',
  },
  bookmark: {
    icon: <Bookmark className="w-4 h-4" />,
    activeColor: 'text-yellow-500',
    hoverColor: 'hover:text-yellow-400',
    animationClass: 'animate-bookmark-in',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1.5',
  md: 'px-3 py-1.5 text-sm gap-2',
  lg: 'px-4 py-2 text-base gap-2.5',
};

const iconSizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const InteractiveReaction = forwardRef<HTMLButtonElement, InteractiveReactionProps>(
  (
    {
      reactionType,
      count,
      onReact,
      size = 'md',
      showCount = true,
      disabled = false,
      className = '',
      isActive: initialIsActive = false,
    },
    ref
  ) => {
    const [isActive, setIsActive] = useState(initialIsActive);
    const [displayCount, setDisplayCount] = useState(count);
    const [isAnimating, setIsAnimating] = useState(false);
    const prevCountRef = useRef(count);
    const animationTimeoutRef = useRef<number>();

    useEffect(() => {
      if (count !== prevCountRef.current) {
        setIsAnimating(true);
        
        // Smooth counter animation
        const startCount = prevCountRef.current;
        const endCount = count;
        const duration = 300;
        const startTime = Date.now();

        const animateCount = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function for smooth animation
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          const currentCount = Math.round(startCount + (endCount - startCount) * easeOutQuart);
          
          setDisplayCount(currentCount);

          if (progress < 1) {
            requestAnimationFrame(animateCount);
          } else {
            setIsAnimating(false);
          }
        };

        requestAnimationFrame(animateCount);
        prevCountRef.current = count;
      }
    }, [count]);

    useEffect(() => {
      return () => {
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
      };
    }, []);

    const handleClick = () => {
      if (disabled) return;

      const newIsActive = !isActive;
      setIsActive(newIsActive);
      
      // Trigger animation
      setIsAnimating(true);
      animationTimeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
      }, 600);

      onReact?.(reactionType, newIsActive);
    };

    const config = reactionConfigs[reactionType];
    const sizeClass = sizeClasses[size];
    const iconSize = iconSizeClasses[size];

    const baseClasses = `
      relative inline-flex items-center justify-center
      rounded-full border border-transparent
      transition-all duration-200 ease-out
      font-medium
      focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
      ${disabled ? '' : 'hover:bg-[var(--gray-100)] dark:hover:bg-[var(--gray-800)]'}
      ${config.hoverColor}
      ${sizeClass}
      ${className}
    `;

    const activeClasses = isActive ? config.activeColor : 'text-[var(--text-secondary)]';
    const animationClasses = isAnimating ? config.animationClass : '';

    return (
      <>
        <style jsx>{`
          @keyframes heart-beat {
            0% { transform: scale(1); }
            25% { transform: scale(1.3); }
            50% { transform: scale(1); }
            75% { transform: scale(1.3); }
            100% { transform: scale(1); }
          }

          @keyframes bounce-in {
            0% { transform: scale(1) translateY(0); }
            25% { transform: scale(0.9) translateY(-8px); }
            50% { transform: scale(1.1) translateY(0); }
            75% { transform: scale(0.95) translateY(-2px); }
            100% { transform: scale(1) translateY(0); }
          }

          @keyframes pulse-in {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes spin-in {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.1); }
            100% { transform: rotate(360deg) scale(1); }
          }

          @keyframes bookmark-in {
            0% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(0.8) rotate(-10deg); }
            50% { transform: scale(1.2) rotate(10deg); }
            75% { transform: scale(0.9) rotate(-5deg); }
            100% { transform: scale(1) rotate(0deg); }
          }

          .animate-heart-beat {
            animation: heart-beat 0.6s ease-in-out;
          }

          .animate-bounce-in {
            animation: bounce-in 0.6s ease-out;
          }

          .animate-pulse-in {
            animation: pulse-in 0.4s ease-out;
          }

          .animate-spin-in {
            animation: spin-in 0.5s ease-in-out;
          }

          .animate-bookmark-in {
            animation: bookmark-in 0.5s ease-in-out;
          }

          .counter-animate {
            transition: transform 0.2s ease-out;
          }

          .counter-animate.pulse {
            animation: counter-pulse 0.3s ease-out;
          }

          @keyframes counter-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}</style>

        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={handleClick}
          className={`${baseClasses} ${activeClasses} ${animationClasses}`.trim()}
        >
          <span className={`${iconSize} ${isAnimating ? animationClasses : ''}`} aria-hidden>
            {config.icon}
          </span>
          
          {showCount && (
            <span 
              className={`counter-animate ${isAnimating ? 'pulse' : ''}`}
              aria-label={`${count} ${reactionType}s`}
            >
              {displayCount}
            </span>
          )}
        </button>
      </>
    );
  }
);

InteractiveReaction.displayName = 'InteractiveReaction';
