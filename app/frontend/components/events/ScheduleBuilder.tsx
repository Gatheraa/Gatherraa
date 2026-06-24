// src/components/events/ScheduleBuilder.tsx
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'framer-motion';
import { GripVertical, Clock, MapPin, Plus, Trash2, Save, RotateCcw } from 'lucide-react';

export interface ScheduleSession {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  speaker: string;
  type: 'workshop' | 'keynote' | 'break' | 'networking';
}

export interface ScheduleBuilderProps {
  initialSessions?: ScheduleSession[];
  onSave?: (sessions: ScheduleSession[]) => void;
  className?: string;
}

export const DEFAULT_SCHEDULE_SESSIONS: ScheduleSession[] = [
  { id: '1', title: 'Opening Ceremony', startTime: '09:00', durationMinutes: 30, location: 'Main Stage', speaker: 'Alice Johnson', type: 'keynote' },
  { id: '2', title: 'Blockchain Fundamentals', startTime: '10:00', durationMinutes: 60, location: 'Room A', speaker: 'Bob Smith', type: 'workshop' },
  { id: '3', title: 'Networking Lunch', startTime: '12:00', durationMinutes: 60, location: 'Cafeteria', speaker: '-', type: 'networking' },
  { id: '4', title: 'Future of DeFi', startTime: '13:30', durationMinutes: 45, location: 'Main Stage', speaker: 'Charlie Brown', type: 'workshop' },
];

const formatAmPm = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getEndTime = (time: string, durationMinutes: number) => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() + durationMinutes);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getTypeColor = (type: ScheduleSession['type']) => {
  switch (type) {
    case 'keynote':    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'workshop':   return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'break':      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'networking': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    default:           return 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400';
  }
};

export const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({
  initialSessions = DEFAULT_SCHEDULE_SESSIONS,
  onSave,
  className = '',
}) => {
  const [items, setItems] = useState<ScheduleSession[]>(initialSessions);
  const [isHovering, setIsHovering] = useState<string | null>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    onSave?.(items);
  }, [items, onSave]);

  const handleReorder = (newOrder: ScheduleSession[]) => setItems(newOrder);

  const handleFieldChange = (
    id: string,
    field: keyof Omit<ScheduleSession, 'id'>,
    value: string | number,
  ) => {
    setItems(current =>
      current.map(s => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const addSession = () => {
    setItems(current => [
      ...current,
      {
        id: Math.random().toString(36).substring(2, 11),
        title: 'New Session',
        startTime: '14:00',
        durationMinutes: 30,
        location: 'TBD',
        speaker: 'TBD',
        type: 'workshop',
      },
    ]);
  };

  const removeSession = (id: string) =>
    setItems(current => current.filter(item => item.id !== id));

  const resetSchedule = () => setItems(initialSessions);

  const conflictIds = useMemo(() => {
    const ranges = items.map(s => {
      const [h, m] = s.startTime.split(':').map(Number);
      const start = h * 60 + m;
      return { id: s.id, start, end: start + s.durationMinutes };
    });
    const conflicts = new Set<string>();
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) {
          conflicts.add(ranges[i].id);
          conflicts.add(ranges[j].id);
        }
      }
    }
    return conflicts;
  }, [items]);

  const hasConflicts = conflictIds.size > 0;

  return (
    <div className={`max-w-4xl mx-auto w-full p-6 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            Agenda Builder
            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">
              Live
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create sessions, manage time slots, and reorder the agenda on desktop or mobile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetSchedule}
            className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-gray-800 rounded-xl transition-all"
            title="Reset to initial"
          >
            <RotateCcw className="w-5 h-5" />
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={addSession}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400 rounded-xl font-semibold border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Session
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSave?.(items)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all"
          >
            <Save className="w-5 h-5" />
            Save Agenda
          </motion.button>
        </div>
      </div>

      {/* Status bar */}
      <div className="mb-4 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-slate-300">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span>{items.length} sessions in your agenda</span>
          <span className={`font-semibold ${hasConflicts ? 'text-rose-600 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'}`}>
            {hasConflicts
              ? 'Time-slot overlap detected. Adjust session times.'
              : 'All session slots are aligned.'}
          </span>
        </div>
      </div>

      {/* Session list */}
      <div className="space-y-4">
        <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-3">
          <AnimatePresence mode="popLayout">
            {items.map(session => {
              const conflict = conflictIds.has(session.id);
              return (
                <Reorder.Item
                  key={session.id}
                  value={session}
                  dragListener={false}
                  dragControls={dragControls}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  onHoverStart={() => setIsHovering(session.id)}
                  onHoverEnd={() => setIsHovering(null)}
                  className="relative list-none"
                >
                  <div
                    className={`p-5 bg-gray-50 dark:bg-gray-800/70 border rounded-2xl transition-all duration-300
                      ${isHovering === session.id ? 'border-indigo-300/40 dark:border-indigo-700/40 shadow-sm' : 'border-transparent'}
                      ${conflict ? 'border-rose-400/40 dark:border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/30' : ''}`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[48px_1fr_auto] items-start">
                      {/* Drag handle */}
                      <div className="flex justify-center items-start">
                        <button
                          type="button"
                          onPointerDown={e => dragControls.start(e)}
                          className="cursor-grab active:cursor-grabbing rounded-2xl p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                          aria-label="Drag session"
                        >
                          <GripVertical className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Fields */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr]">
                        <div className="space-y-3">
                          <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            Session title
                          </label>
                          <input
                            type="text"
                            value={session.title}
                            onChange={e => handleFieldChange(session.id, 'title', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                Start time
                              </label>
                              <input
                                type="time"
                                value={session.startTime}
                                onChange={e => handleFieldChange(session.id, 'startTime', e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                Duration
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={15}
                                  step={15}
                                  value={session.durationMinutes}
                                  onChange={e => handleFieldChange(session.id, 'durationMinutes', Number(e.target.value))}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-16 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                                />
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">
                                  min
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="inline w-3 h-3 mr-1" />
                            {formatAmPm(session.startTime)} – {getEndTime(session.startTime, session.durationMinutes)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 items-end justify-between">
                        <button
                          type="button"
                          onClick={() => removeSession(session.id)}
                          className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200 hover:dark:bg-rose-900/40"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </button>
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] ${getTypeColor(session.type)}`}>
                          {session.type}
                        </span>
                      </div>
                    </div>

                    {/* Location + Speaker + Type */}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                          <MapPin className="inline w-3 h-3 mr-1" />Location
                        </label>
                        <input
                          type="text"
                          value={session.location}
                          onChange={e => handleFieldChange(session.id, 'location', e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                          Speaker
                        </label>
                        <input
                          type="text"
                          value={session.speaker}
                          onChange={e => handleFieldChange(session.id, 'speaker', e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Session type
                      </label>
                      <select
                        value={session.type}
                        onChange={e => handleFieldChange(session.id, 'type', e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                      >
                        <option value="workshop">Workshop</option>
                        <option value="keynote">Keynote</option>
                        <option value="break">Break</option>
                        <option value="networking">Networking</option>
                      </select>
                    </div>
                  </div>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>

        {items.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700"
          >
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No sessions yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
              Start building your event schedule by adding your first session.
            </p>
            <button
              type="button"
              onClick={addSession}
              className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-md active:scale-95 transition-all"
            >
              Add First Session
            </button>
          </motion.div>
        )}
      </div>

      {/* Pro tip */}
      <div className="mt-10 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/20 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <GripVertical className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Pro-Tip for Organizers</h4>
          <p className="text-xs text-indigo-700/70 dark:text-indigo-300/60 mt-0.5">
            Use the handle on the left of each session to reorder items. Mobile-friendly drag and drop is supported across all session cards.
          </p>
        </div>
      </div>
    </div>
  );
};