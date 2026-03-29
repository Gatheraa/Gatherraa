"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, Users, Info, ChevronRight } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  attendees: number;
  description: string;
  image?: string;
  category: string;
}

interface VirtualizedEventListProps {
  events: Event[];
  rowHeight?: number;
  visibleCount?: number;
  buffer?: number;
  className?: string;
  onEventClick?: (event: Event) => void;
}

const VirtualizedEventList: React.FC<VirtualizedEventListProps> = ({
  events,
  rowHeight = 160,
  visibleCount = 10,
  buffer = 5,
  className = '',
  onEventClick,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a resize observer to dynamically adjust visible count if needed
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const totalHeight = events.length * rowHeight;
  
  // Calculate indices for visible items
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(
    events.length - 1,
    Math.floor((scrollTop + (visibleCount * rowHeight)) / rowHeight) + buffer
  );

  const visibleEvents = useMemo(() => {
    return events.slice(startIndex, endIndex + 1).map((event, index) => ({
      event,
      actualIndex: startIndex + index,
    }));
  }, [events, startIndex, endIndex]);

  const renderEventCard = (event: Event, index: number) => {
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (index % 5) * 0.05 }}
        style={{
          position: 'absolute',
          top: (startIndex + index) * rowHeight,
          left: 0,
          right: 0,
          height: rowHeight - 16, // margin
          margin: '8px 16px',
        }}
        className="group"
      >
        <div 
          onClick={() => onEventClick?.(event)}
          className="h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex"
        >
          {/* Category accent */}
          <div className="w-1 bg-indigo-500 h-full group-hover:w-2 transition-all duration-300" />
          
          <div className="flex-1 p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full">
                  {event.category}
                </span>
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <Users className="w-3.5 h-3.5" />
                  <span>{event.attendees}</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {event.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                {event.description}
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="truncate">{event.location}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 flex items-center justify-center border-l border-gray-50 dark:border-gray-700/50 bg-gray-50/30 group-hover:bg-indigo-50/50 dark:bg-gray-800 dark:group-hover:bg-indigo-900/10 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-all" />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div 
      className={`relative w-full max-w-4xl mx-auto overflow-hidden bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 ${className}`}
      style={{ height: visibleCount * rowHeight }}
    >
      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleEvents.map(({ event }, index) => renderEventCard(event, index))}
        </div>
        
        {events.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Info className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No events scheduled</p>
          </div>
        )}
      </div>
      
      {/* Scroll indicator for smooth look */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent pointer-events-none" />
    </div>
  );
};

export { VirtualizedEventList };
export type { VirtualizedEventListProps };
