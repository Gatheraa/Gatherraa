import React from 'react';
import clsx from 'clsx';

export default function EventTimeline({ events, currentTime }) {
  // Ensure events are sorted by start time
  const sortedEvents = [...events].sort((a, b) => a.start - b.start);

  return (
    <div className="relative border-l-2 border-gray-200 pl-6">
      {sortedEvents.map((event, idx) => {
        const isCurrent =
          currentTime >= event.start && currentTime <= event.end;

        return (
          <div key={idx} className="mb-10 relative">
            {/* Timeline marker */}
            <div
              className={clsx(
                "absolute -left-3 w-6 h-6 rounded-full border-2",
                isCurrent
                  ? "bg-purple-600 border-purple-600"
                  : "bg-white border-gray-300"
              )}
            />
            {/* Event details */}
            <div>
              <time className="text-sm text-gray-500">
                {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
              <h3
                className={clsx(
                  "mt-1 text-lg font-semibold",
                  isCurrent ? "text-purple-600" : "text-gray-800"
                )}
              >
                {event.title}
              </h3>
              <p className="text-gray-600">{event.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
