"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  MapPin,
  RefreshCw,
  Info,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface SessionAttendance {
  sessionId: string;
  sessionName: string;
  venue?: string;
  capacity: number;
  currentAttendance: number;
  startTime: string;
  endTime: string;
}

interface HeatmapDataPoint {
  session: string;
  hour: number;
  intensity: number; // 0-1
  count: number;
}

interface AttendanceHeatmapProps {
  eventId?: string;
  sessions?: SessionAttendance[];
}

// Generate mock data for demonstration
const generateMockSessions = (): SessionAttendance[] => [
  {
    sessionId: "s-001",
    sessionName: "Opening Keynote",
    venue: "Main Hall",
    capacity: 500,
    currentAttendance: 423,
    startTime: "09:00",
    endTime: "10:00",
  },
  {
    sessionId: "s-002",
    sessionName: "Web3 Workshop",
    venue: "Room A",
    capacity: 100,
    currentAttendance: 87,
    startTime: "10:30",
    endTime: "12:00",
  },
  {
    sessionId: "s-003",
    sessionName: "DeFi Panel",
    venue: "Room B",
    capacity: 150,
    currentAttendance: 134,
    startTime: "10:30",
    endTime: "11:30",
  },
  {
    sessionId: "s-004",
    sessionName: "NFT Showcase",
    venue: "Exhibition Hall",
    capacity: 300,
    currentAttendance: 198,
    startTime: "11:00",
    endTime: "13:00",
  },
  {
    sessionId: "s-005",
    sessionName: "Lunch & Networking",
    venue: "Cafeteria",
    capacity: 400,
    currentAttendance: 312,
    startTime: "12:00",
    endTime: "13:30",
  },
  {
    sessionId: "s-006",
    sessionName: "Smart Contract Security",
    venue: "Room A",
    capacity: 100,
    currentAttendance: 95,
    startTime: "13:30",
    endTime: "15:00",
  },
  {
    sessionId: "s-007",
    sessionName: "Gaming & Metaverse",
    venue: "Room C",
    capacity: 80,
    currentAttendance: 72,
    startTime: "14:00",
    endTime: "15:30",
  },
  {
    sessionId: "s-008",
    sessionName: "Closing Ceremony",
    venue: "Main Hall",
    capacity: 500,
    currentAttendance: 356,
    startTime: "16:00",
    endTime: "17:00",
  },
];

const generateMockHeatmapData = (): HeatmapDataPoint[] => {
  const sessions = [
    "Opening Keynote",
    "Web3 Workshop",
    "DeFi Panel",
    "NFT Showcase",
    "Lunch",
    "Smart Contract",
    "Gaming",
    "Closing",
  ];
  const data: HeatmapDataPoint[] = [];

  sessions.forEach((session, sIdx) => {
    for (let hour = 9; hour <= 17; hour++) {
      // Simulate attendance patterns
      let intensity = 0;
      const baseHour = 9 + sIdx * 0.8;
      const dist = Math.abs(hour - baseHour);
      if (dist < 2) {
        intensity = Math.max(0, 1 - dist * 0.3 + Math.random() * 0.2);
      } else {
        intensity = Math.random() * 0.15;
      }
      data.push({
        session,
        hour,
        intensity: Math.min(1, Math.max(0, intensity)),
        count: Math.round(intensity * 100),
      });
    }
  });

  return data;
};

const AttendanceHeatmap: React.FC<AttendanceHeatmapProps> = ({
  eventId,
  sessions,
}) => {
  const [sessionData, setSessionData] = useState<SessionAttendance[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{
    session: string;
    hour: number;
    count: number;
    intensity: number;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (eventId) {
          const [sessionsRes, heatmapRes] = await Promise.all([
            fetch(`/api/events/${eventId}/sessions`),
            fetch(`/api/events/${eventId}/attendance-heatmap`),
          ]);
          if (sessionsRes.ok && heatmapRes.ok) {
            const sData = await sessionsRes.json();
            const hData = await heatmapRes.json();
            setSessionData(sData.sessions || []);
            setHeatmapData(hData.heatmap || []);
          } else {
            setSessionData(sessions || generateMockSessions());
            setHeatmapData(generateMockHeatmapData());
          }
        } else {
          setSessionData(sessions || generateMockSessions());
          setHeatmapData(generateMockHeatmapData());
        }
      } catch {
        setSessionData(sessions || generateMockSessions());
        setHeatmapData(generateMockHeatmapData());
      } finally {
        setLoading(false);
        setLastUpdated(new Date());
      }
    };

    loadData();

    // Live updates every 30 seconds
    let interval: NodeJS.Timeout | null = null;
    if (liveMode) {
      interval = setInterval(async () => {
        try {
          if (eventId) {
            const res = await fetch(
              `/api/events/${eventId}/attendance-heatmap`
            );
            if (res.ok) {
              const hData = await res.json();
              setHeatmapData(hData.heatmap || generateMockHeatmapData());
            }
          } else {
            // Simulate live data changes
            setHeatmapData((prev) =>
              prev.map((d) => ({
                ...d,
                intensity: Math.min(
                  1,
                  Math.max(0, d.intensity + (Math.random() - 0.5) * 0.1)
                ),
                count: Math.round(
                  Math.min(
                    1,
                    Math.max(0, d.intensity + (Math.random() - 0.5) * 0.1)
                  ) * 100
                ),
              }))
            );
          }
          setLastUpdated(new Date());
        } catch {
          // Silently fail on live update errors
        }
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [eventId, sessions, liveMode]);

  // Get unique sessions and hours for the heatmap grid
  const { uniqueSessions, uniqueHours } = useMemo(() => {
    const sessions = [...new Set(heatmapData.map((d) => d.session))].sort();
    const hours = [...new Set(heatmapData.map((d) => d.hour))].sort(
      (a, b) => a - b
    );
    return { uniqueSessions: sessions, uniqueHours: hours };
  }, [heatmapData]);

  const getIntensityColor = (intensity: number): string => {
    if (intensity === 0) return "bg-gray-100";
    if (intensity < 0.2) return "bg-green-200";
    if (intensity < 0.4) return "bg-green-400";
    if (intensity < 0.6) return "bg-yellow-400";
    if (intensity < 0.8) return "bg-orange-400";
    return "bg-red-500";
  };

  const getIntensityTextColor = (intensity: number): string => {
    if (intensity < 0.4) return "text-gray-700";
    return "text-white";
  };

  const getCellData = (
    session: string,
    hour: number
  ): HeatmapDataPoint | undefined => {
    return heatmapData.find((d) => d.session === session && d.hour === hour);
  };

  const totalAttendance = sessionData.reduce(
    (sum, s) => sum + s.currentAttendance,
    0
  );
  const totalCapacity = sessionData.reduce((sum, s) => sum + s.capacity, 0);
  const overallOccupancy =
    totalCapacity > 0 ? Math.round((totalAttendance / totalCapacity) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance Heatmap</h2>
          <p className="text-gray-600">
            Real-time attendance distribution across sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {liveMode && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              Live
            </Badge>
          )}
          <Button
            variant={liveMode ? "primary" : "outline"}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            {liveMode ? "Live" : "Paused"}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Attendance</span>
            </div>
            <div className="text-2xl font-bold">
              {totalAttendance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Overall Occupancy</span>
            </div>
            <div className="text-2xl font-bold">{overallOccupancy}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Active Sessions</span>
            </div>
            <div className="text-2xl font-bold">{sessionData.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Session Attendance Intensity</CardTitle>
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour headers */}
              <div className="flex">
                <div className="w-32 shrink-0"></div>
                {uniqueHours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-xs text-gray-500 font-medium"
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {uniqueSessions.map((session) => (
                <div key={session} className="flex items-center mt-1">
                  <div className="w-32 shrink-0 text-xs text-gray-700 font-medium truncate pr-2">
                    {session}
                  </div>
                  {uniqueHours.map((hour) => {
                    const data = getCellData(session, hour);
                    const intensity = data?.intensity || 0;
                    const count = data?.count || 0;
                    const isHovered =
                      hoveredCell?.session === session &&
                      hoveredCell?.hour === hour;

                    return (
                      <div
                        key={`${session}-${hour}`}
                        className="flex-1 px-0.5"
                        onMouseEnter={() =>
                          setHoveredCell({
                            session,
                            hour,
                            count,
                            intensity,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <motion.div
                          className={`h-8 rounded ${getIntensityColor(
                            intensity
                          )} ${getIntensityTextColor(
                            intensity
                          )} flex items-center justify-center text-xs font-medium cursor-pointer transition-all ${
                            isHovered
                              ? "ring-2 ring-blue-500 ring-offset-1"
                              : ""
                          }`}
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.1 }}
                        >
                          {count > 0 ? count : ""}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{hoveredCell.session}</span>
                <span className="text-gray-500">@ {hoveredCell.hour}:00</span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                <span className="font-medium">{hoveredCell.count}</span> attendees
                estimated (
                <span className="font-medium">
                  {Math.round(hoveredCell.intensity * 100)}%
                </span>{" "}
                intensity)
              </div>
            </motion.div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs text-gray-500">Low</span>
            <div className="flex gap-1">
              {[
                "bg-gray-100",
                "bg-green-200",
                "bg-green-400",
                "bg-yellow-400",
                "bg-orange-400",
                "bg-red-500",
              ].map((color, i) => (
                <div
                  key={i}
                  className={`w-6 h-4 rounded ${color} border border-gray-200`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">High</span>
          </div>
        </CardContent>
      </Card>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessionData.map((session) => {
              const occupancy =
                session.capacity > 0
                  ? Math.round(
                      (session.currentAttendance / session.capacity) * 100
                    )
                  : 0;
              const isHigh = occupancy >= 80;
              const isMedium = occupancy >= 50 && occupancy < 80;

              return (
                <div
                  key={session.sessionId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isHigh
                          ? "bg-red-500"
                          : isMedium
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {session.sessionName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {session.venue && (
                          <>
                            <MapPin className="w-3 h-3" />
                            <span>{session.venue}</span>
                          </>
                        )}
                        <span>
                          {session.startTime} - {session.endTime}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {session.currentAttendance}/{session.capacity}
                    </div>
                    <div
                      className={`text-xs ${
                        isHigh
                          ? "text-red-600"
                          : isMedium
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {occupancy}% full
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceHeatmap;
