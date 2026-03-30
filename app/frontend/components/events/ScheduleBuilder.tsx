"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { GripVertical, Clock, MapPin, Plus, Trash2, Edit3, Save, RotateCcw } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  time: string;
  duration: string;
  location: string;
  speaker: string;
  type: 'workshop' | 'keynote' | 'break' | 'networking';
}

interface ScheduleBuilderProps {
  initialSessions?: Session[];
  onSave?: (sessions: Session[]) => void;
  className?: string;
}

const DEFAULT_SESSIONS: Session[] = [
  { id: '1', title: 'Opening Ceremony', time: '09:00 AM', duration: '30 min', location: 'Main Stage', speaker: 'Alice Johnson', type: 'keynote' },
  { id: '2', title: 'Blockchain Fundamentals', time: '10:00 AM', duration: '60 min', location: 'Room A', speaker: 'Bob Smith', type: 'workshop' },
  { id: '3', title: 'Networking Lunch', time: '12:00 PM', duration: '60 min', location: 'Cafeteria', speaker: '-', type: 'networking' },
  { id: '4', title: 'Future of DeFi', time: '01:30 PM', duration: '45 min', location: 'Main Stage', speaker: 'Charlie Brown', type: 'workshop' },
];

const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({
  initialSessions = DEFAULT_SESSIONS,
  onSave,
  className = '',
}) => {
  const [items, setItems] = useState<Session[]>(initialSessions);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState<string | null>(null);

  const handleReorder = (newOrder: Session[]) => {
    setItems(newOrder);
  };

  const addSession = () => {
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Session',
      time: '12:00 PM',
      duration: '45 min',
      location: 'TBD',
      speaker: 'TBD',
      type: 'workshop',
    };
    setItems([...items, newSession]);
  };

  const removeSession = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const saveChanges = () => {
    onSave?.(items);
    setIsEditing(false);
  };

  const resetSchedule = () => {
    setItems(initialSessions);
  };

  const getTypeColor = (type: Session['type']) => {
    switch (type) {
      case 'keynote': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'workshop': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'break': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'networking': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400';
    }
  };

  return (
    <div className={`max-w-4xl mx-auto w-full p-6 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            Schedule Builder
            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">Editor</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Drag and drop to reorder sessions or add new ones.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetSchedule}
            className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-gray-800 rounded-xl transition-all"
            title="Reset to initial"
          >
            <RotateCcw className="w-5 h-5" />
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={addSession}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400 rounded-xl font-semibold border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Session
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={saveChanges}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all"
          >
            <Save className="w-5 h-5" />
            Save Changes
          </motion.button>
        </div>
      </div>

      {/* Schedule List */}
      <div className="space-y-4">
        <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-3">
          <AnimatePresence mode="popLayout">
            {items.map((session) => (
              <Reorder.Item 
                key={session.id} 
                value={session}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onHoverStart={() => setIsHovering(session.id)}
                onHoverEnd={() => setIsHovering(null)}
                className="relative group list-none"
              >
                <div className={`p-5 flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 border border-transparent rounded-2xl transition-all duration-300 ${isHovering === session.id ? 'border-indigo-300/40 dark:border-indigo-700/40 shadow-sm' : ''}`}>
                  {/* Grip Handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-500 transition-colors p-1">
                    <GripVertical className="w-6 h-6" />
                  </div>
                  
                  {/* Content Container */}
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Time & Session Type */}
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-lg mb-1">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        {session.time}
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getTypeColor(session.type)}`}>
                        {session.type}
                      </span>
                    </div>
                    
                    {/* Title & Speaker */}
                    <div className="md:col-span-5">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-500 transition-colors">
                        {session.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-gray-900 dark:text-gray-300">{session.speaker}</span>
                        <span>• {session.duration}</span>
                      </p>
                    </div>
                    
                    {/* Location */}
                    <div className="md:col-span-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 truncate">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{session.location}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all" title="Edit Session">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removeSession(session.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">Start building your event schedule by adding your first session.</p>
            <button 
              onClick={addSession}
              className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-md active:scale-95 transition-all"
            >
              Add First Session
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-10 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/20 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <GripVertical className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Pro-Tip for Organizers</h4>
          <p className="text-xs text-indigo-700/70 dark:text-indigo-300/60 mt-0.5">Use the handle on the left of each session to reorder items. Your schedule will automatically refresh for all attendees once saved.</p>
        </div>
      </div>
    </div>
  );
};

export { ScheduleBuilder };
export type { ScheduleBuilderProps };
