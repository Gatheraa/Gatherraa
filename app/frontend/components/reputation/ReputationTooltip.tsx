"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ReputationTooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function ReputationTooltip({
  content,
  children,
  position = "top",
}: ReputationTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    let x = 0;
    let y = 0;
    if (position === "top") {
      x = trigger.left + trigger.width / 2 - tip.width / 2;
      y = trigger.top - tip.height - gap;
    } else if (position === "bottom") {
      x = trigger.left + trigger.width / 2 - tip.width / 2;
      y = trigger.bottom + gap;
    } else if (position === "left") {
      x = trigger.left - tip.width - gap;
      y = trigger.top + trigger.height / 2 - tip.height / 2;
    } else {
      x = trigger.right + gap;
      y = trigger.top + trigger.height / 2 - tip.height / 2;
    }
    // Clamp to viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tip.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tip.height - 8));
    setCoords({ x, y });
  }, [position]);

  useEffect(() => {
    if (visible) {
      // Allow tooltip to render first, then measure
      requestAnimationFrame(reposition);
    }
  }, [visible, reposition]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
        className="reputation-tooltip-trigger"
        aria-describedby={visible ? "reputation-tooltip" : undefined}
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          id="reputation-tooltip"
          role="tooltip"
          style={{ left: coords.x, top: coords.y }}
          className="reputation-tooltip-box"
        >
          {content}
        </div>
      )}
    </>
  );
}