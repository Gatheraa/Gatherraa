'use client';

import React, { useState, useEffect } from 'react';

interface EventCountdownTimerProps {
  startTime: Date;
}

const EventCountdownTimer: React.FC<EventCountdownTimerProps> = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  function calculateTimeLeft() {
    const now = new Date();
    const difference = startTime.getTime() - now.getTime();

    if (difference <= 0) {
      return {
        isLive: now >= startTime,
        isEnded: now > startTime,
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      isLive: false,
      isEnded: false,
    };
  }

  if (timeLeft.isLive) {
    return <span>Live</span>;
  }

  if (timeLeft.isEnded) {
    return <span>Ended</span>;
  }

  if (timeLeft.days === undefined) return null;

  return (
    <div>
      {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
    </div>
  );
};

export default EventCountdownTimer;

/*
Example Usage:
<EventCountdownTimer startTime={new Date('2024-01-01T10:00:00')} />

Possible improvements:
Make it look nicer with some CSS
Add handling for cases where the event has already started
*/