"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, MapPin, RefreshCw } from "lucide-react";

interface SessionData {
  id: string;
  name: string;
  venue: string;
  timeSlot: string;
  attendance: number;
  capacity: number;
}

const VENUES = ["Main Hall", "Room A", "Room B", "Workshop 1", "Workshop 2"];
const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

function generateMockData(): SessionData[] {
  const data: SessionData[] = [];
  VENUES.forEach((venue) => {
    TIME_SLOTS.forEach((timeSlot) => {
      // Simulate higher attendance in Main Hall and early slots
      const baseAttendance = venue === "Main Hall" ? 200 : 50;
      const timeMultiplier = timeSlot.startsWith("09") || timeSlot.startsWith("13") ? 1.5 : 0.8;
      const randomFactor = 0.5 + Math.random();
      
      const capacity = venue === "Main Hall" ? 500 : 150;
      const attendance = Math.floor(Math.min(capacity, baseAttendance * timeMultiplier * randomFactor));
      
      data.push({
        id: `${venue}-${timeSlot}`,
        name: `${venue} Session`,
        venue,
        timeSlot,
        attendance,
        capacity,
      });
    });
  });
  return data;
}

function getHeatColor(attendance: number, capacity: number) {
  const ratio = attendance / capacity;
  if (ratio > 0.85) return "bg-red-500 border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.3)]";
  if (ratio > 0.6) return "bg-orange-500 border-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.2)]";
  if (ratio > 0.3) return "bg-amber-400 border-amber-500 shadow-[0_0_5px_rgba(251,191,36,0.1)]";
  if (ratio > 0.1) return "bg-emerald-400 border-emerald-500";
  return "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700";
}

export function AttendanceHeatmap() {
  const [data, setData] = useState<SessionData[]>([]);
  const [hoveredCell, setHoveredCell] = useState<SessionData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = () => {
    setIsUpdating(true);
    // Simulate network latency for live updates
    setTimeout(() => {
      setData(generateMockData());
      setLastUpdated(new Date());
      setIsUpdating(false);
    }, 600);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Live update every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 rounded-xl">
      <div className="flex items-center justify-between mb-6 px-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            Session Attendance Density
          </h3>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Live updates across all venues
          </p>
        </div>
        <button 
          onClick={fetchData}
          disabled={isUpdating}
          className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 relative">
        <div className="min-w-[600px]">
          {/* Header row with times */}
          <div className="flex mb-2">
            <div className="w-24 shrink-0" />
            <div className="flex-1 flex justify-between px-2">
              {TIME_SLOTS.map((time) => (
                <div key={time} className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider w-8 text-center">
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="space-y-3">
            {VENUES.map((venue) => (
              <div key={venue} className="flex items-center">
                <div className="w-24 shrink-0 flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  <MapPin className="w-3 h-3 text-zinc-400" />
                  <span className="truncate" title={venue}>{venue}</span>
                </div>
                <div className="flex-1 flex justify-between px-2 relative group">
                  {TIME_SLOTS.map((time) => {
                    const session = data.find((d) => d.venue === venue && d.timeSlot === time);
                    if (!session) return <div key={time} className="w-8 h-8" />;

                    const ratio = session.attendance / session.capacity;
                    
                    return (
                      <div 
                        key={time} 
                        className="relative w-8 h-8 sm:w-10 sm:h-10 cursor-crosshair"
                        onMouseEnter={() => setHoveredCell(session)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <motion.div
                          layoutId={`cell-${session.id}`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className={`absolute inset-1 rounded-md border ${getHeatColor(session.attendance, session.capacity)} transition-colors duration-500`}
                        />
                        {/* Inner pulse for high intensity */}
                        {ratio > 0.85 && (
                          <span className="absolute inset-1 rounded-md animate-ping bg-red-400 opacity-20" />
                        )}
                        {/* Hover Tooltip nested inside the cell */}
                        <AnimatePresence>
                          {hoveredCell?.id === session.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.95 }}
                              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none bg-zinc-900 dark:bg-black border border-zinc-700/50 rounded-xl p-3 shadow-xl w-48 text-left"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-white truncate max-w-[120px]">{session.name}</p>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                  {session.timeSlot}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-end">
                                  <span className="text-[10px] text-zinc-400">Attendance</span>
                                  <span className="text-sm font-bold text-white">{session.attendance}</span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="h-full bg-primary" 
                                    style={{ width: `${(session.attendance / session.capacity) * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[9px] text-zinc-500">
                                  <span>0</span>
                                  <span>{session.capacity} cap</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-4 text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-amber-400" />
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-red-500" />
            <span>Full</span>
          </div>
        </div>
        <div className="text-[9px] text-zinc-400">
          Updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
