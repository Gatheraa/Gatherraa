import { useEffect } from "react";
import { useWaitlist } from "./useWaitlist";

export const AvailabilityNotification = () => {
  const { available, checkAvailability } = useWaitlist();

  useEffect(() => {
    const interval = setInterval(() => {
      checkAvailability();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!available) return null;

  return (
    <div className="notification">
      🎉 Good news! A spot is now available.
    </div>
  );
};