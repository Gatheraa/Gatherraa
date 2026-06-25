import { useEffect, useState } from "react";

/**
 * EventCapacityIndicator
 *
 * Displays real-time capacity tracking for an event.
 *
 * Props:
 * - totalCapacity (number): Max number of attendees allowed
 * - registeredCount (number): Current number of registered users
 * - onUpdate (function): Optional callback that fires every live update cycle
 * - updateInterval (number): How often (ms) to simulate a live refresh. Default: 5000
 */

interface EventCapacityIndicatorProps {
  totalCapacity?: number;
  registeredCount?: number;
  onUpdate?: () => void;
  updateInterval?: number;
}

export default function EventCapacityIndicator({
  totalCapacity = 100,
  registeredCount = 0,
  onUpdate,
  updateInterval = 5000,
}: EventCapacityIndicatorProps) {
  const [currentCount, setCurrentCount] = useState(registeredCount);
  const [isLive, setIsLive] = useState(false);

  const percentage = Math.min((currentCount / totalCapacity) * 100, 100);
  const spotsLeft = totalCapacity - currentCount;
  const isFull = spotsLeft <= 0;
  const isAlmostFull = !isFull && percentage >= 80;

  useEffect(() => {
    const interval = setInterval(() => {
      setIsLive(true);
      if (onUpdate) onUpdate();
      setTimeout(() => setIsLive(false), 1000);
    }, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval, onUpdate]);

  useEffect(() => {
    setCurrentCount(registeredCount);
  }, [registeredCount]);

  const getBarColor = () => {
    if (isFull) return "#ef4444";
    if (isAlmostFull) return "#f97316";
    return "#22c55e";
  };

  return (
    <div
      role="region"
      aria-label="Event capacity indicator"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px 24px",
        maxWidth: "420px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontWeight: 600, fontSize: "15px", color: "#111827" }}>
          Event Capacity
        </span>
        <span
          aria-label={isLive ? "Updating" : "Live"}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6b7280" }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isLive ? "#22c55e" : "#d1d5db",
              display: "inline-block",
              transition: "background-color 0.3s ease",
              boxShadow: isLive ? "0 0 0 3px rgba(34,197,94,0.25)" : "none",
            }}
          />
          LIVE
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", color: "#374151" }}>
          <strong style={{ fontSize: "22px", color: "#111827" }}>{currentCount}</strong>
          <span style={{ color: "#9ca3af" }}> / {totalCapacity} registered</span>
        </span>
        <span style={{ fontSize: "13px", color: isFull ? "#ef4444" : "#6b7280", fontWeight: 500 }}>
          {isFull ? "Sold out" : \ left}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={currentCount}
        aria-valuemin={0}
        aria-valuemax={totalCapacity}
        aria-label={\% capacity filled}
        style={{
          background: "#f3f4f6",
          borderRadius: "999px",
          height: "10px",
          overflow: "hidden",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: \%,
            height: "100%",
            background: getBarColor(),
            borderRadius: "999px",
            transition: "width 0.5s ease, background-color 0.3s ease",
          }}
        />
      </div>

      {(isAlmostFull || isFull) && (
        <div
          role="alert"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: isFull ? "#fee2e2" : "#fff7ed",
            color: isFull ? "#b91c1c" : "#c2410c",
            fontSize: "12px",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "999px",
            border: 1px solid \,
          }}
        >
          {isFull ? "Event Full" : "Almost Full"}
        </div>
      )}
    </div>
  );
}
