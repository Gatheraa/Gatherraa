"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Clock, LogOut, RefreshCcw, ShieldAlert } from 'lucide-react';

interface SessionTimeoutHandlerProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onLogout?: () => void;
  onRefresh?: () => Promise<void>;
  className?: string;
}

const SessionTimeoutHandler: React.FC<SessionTimeoutHandlerProps> = ({
  timeoutMinutes = 15,
  warningMinutes = 2,
  onLogout,
  onRefresh,
  className = '',
}) => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(() => {
    setIsWarningOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      // Default logout logic (e.g., clear localStorage, redirect)
      window.location.href = '/login';
    }
  }, [onLogout]);

  const refreshSession = useCallback(async () => {
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setIsWarningOpen(false);
      lastActivityRef.current = Date.now();
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  }, [onRefresh]);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (isWarningOpen) {
        // Optionally auto-refresh if they become active during warning
        // refreshSession();
      }
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(event => document.addEventListener(event, handleActivity));

    const checkInactivity = () => {
      const now = Date.now();
      const inactiveMs = now - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

      if (inactiveMs >= timeoutMs) {
        logout();
      } else if (inactiveMs >= warningMs && !isWarningOpen) {
        setIsWarningOpen(true);
        setSecondsRemaining(Math.floor((timeoutMs - inactiveMs) / 1000));
      } else if (isWarningOpen) {
        setSecondsRemaining(Math.floor((timeoutMs - inactiveMs) / 1000));
      }
    };

    timerRef.current = setInterval(checkInactivity, 1000);

    return () => {
      activityEvents.forEach(event => document.removeEventListener(event, handleActivity));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMinutes, warningMinutes, isWarningOpen, logout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isWarningOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden ${className}`}
          >
            <div className="p-1 bg-amber-500" />
            
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Session Security</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Inactivity detected</p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 mb-8 text-center ring-1 ring-inset ring-gray-100 dark:ring-gray-700">
                <div className="flex justify-center mb-2">
                  <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />
                </div>
                <div className="text-4xl font-black text-gray-900 dark:text-white font-mono tracking-tighter">
                  {formatTime(secondsRemaining)}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-widest font-bold">Time Remaining</p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                For your security, you will be automatically logged out soon. Would you like to stay connected?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={logout}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={refreshSession}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Stay Active
                </motion.button>
              </div>
            </div>
            
            <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gatherraa Secure Session Manager</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export { SessionTimeoutHandler };
export type { SessionTimeoutHandlerProps };
