"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Clock, LogOut, RefreshCw, X } from 'lucide-react';

// Types for the component
interface SessionTimeoutManagerProps {
  sessionTimeout?: number; // in milliseconds
  warningTime?: number; // time before timeout to show warning (in milliseconds)
  onTimeout?: () => void;
  onExtendSession?: () => Promise<boolean>; // returns true if session was successfully extended
  onWarning?: (timeRemaining: number) => void;
  enableActivityTracking?: boolean;
  logoutUrl?: string;
  className?: string;
}

interface ActivityEvent {
  type: string;
  timestamp: number;
}

const SessionTimeoutManager: React.FC<SessionTimeoutManagerProps> = ({
  sessionTimeout = 30 * 60 * 1000, // 30 minutes default
  warningTime = 5 * 60 * 1000, // 5 minutes warning default
  onTimeout,
  onExtendSession,
  onWarning,
  enableActivityTracking = true,
  logoutUrl,
  className = '',
}) => {
  const [timeRemaining, setTimeRemaining] = useState(sessionTimeout);
  const [showWarning, setShowWarning] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const intervalRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);
  const activityEventsRef = useRef<ActivityEvent[]>([]);

  // Format time for display
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle user activity
  const handleUserActivity = useCallback(() => {
    if (!enableActivityTracking || isExpired) return;
    
    const now = Date.now();
    setLastActivity(now);
    
    // Track activity events (keep last 10 for debugging)
    activityEventsRef.current.push({
      type: 'user_activity',
      timestamp: now,
    });
    
    if (activityEventsRef.current.length > 10) {
      activityEventsRef.current = activityEventsRef.current.slice(-10);
    }
  }, [enableActivityTracking, isExpired]);

  // Set up activity listeners
  useEffect(() => {
    if (!enableActivityTracking) return;

    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click',
      'keydown', 'keyup', 'focus', 'blur'
    ];

    const handleActivity = () => handleUserActivity();

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [handleUserActivity, enableActivityTracking]);

  // Check if session should be extended based on activity
  const shouldExtendSession = useCallback(() => {
    if (!enableActivityTracking) return false;
    
    const timeSinceActivity = Date.now() - lastActivity;
    const shouldExtend = timeSinceActivity < 60000; // Extend if activity within last minute
    
    return shouldExtend;
  }, [enableActivityTracking, lastActivity]);

  // Extend session
  const extendSession = useCallback(async () => {
    setIsExtending(true);
    
    try {
      let success = true;
      
      if (onExtendSession) {
        success = await onExtendSession();
      }
      
      if (success) {
        setTimeRemaining(sessionTimeout);
        setShowWarning(false);
        setIsExpired(false);
        setLastActivity(Date.now());
      } else {
        // If extension failed, show error and potentially logout
        console.error('Failed to extend session');
        if (onWarning) {
          onWarning(timeRemaining);
        }
      }
    } catch (error) {
      console.error('Error extending session:', error);
      if (onWarning) {
        onWarning(timeRemaining);
      }
    } finally {
      setIsExtending(false);
    }
  }, [onExtendSession, sessionTimeout, timeRemaining, onWarning]);

  // Handle timeout
  const handleTimeout = useCallback(() => {
    setIsExpired(true);
    setShowWarning(false);
    
    if (onTimeout) {
      onTimeout();
    } else if (logoutUrl) {
      window.location.href = logoutUrl;
    }
  }, [onTimeout, logoutUrl]);

  // Main timer logic
  useEffect(() => {
    const startTimer = () => {
      // Clear existing intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }

      // Set warning timeout
      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(true);
        if (onWarning) {
          onWarning(warningTime);
        }
      }, sessionTimeout - warningTime);

      // Set main interval
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev: number) => {
          const newTime = prev - 1000;
          
          // Check for automatic extension based on activity
          if (shouldExtendSession() && newTime > warningTime) {
            extendSession();
            return sessionTimeout;
          }
          
          // Handle timeout
          if (newTime <= 0) {
            handleTimeout();
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    };

    startTimer();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [sessionTimeout, warningTime, onWarning, shouldExtendSession, extendSession, handleTimeout]);

  // Don't render anything if not showing warning and not expired
  if (!showWarning && !isExpired) {
    return null;
  }

  return (
    <AnimatePresence>
      {(showWarning || isExpired) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  isExpired ? 'bg-red-100' : 'bg-yellow-100'
                }`}>
                  {isExpired ? (
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  ) : (
                    <Clock className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    isExpired ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {isExpired ? 'Session Expired' : 'Session Timeout Warning'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isExpired 
                      ? 'Your session has expired due to inactivity'
                      : 'Your session will expire soon due to inactivity'
                    }
                  </p>
                </div>
              </div>
              {!isExpired && (
                <button
                  onClick={() => setShowWarning(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Timer Display */}
            <div className={`text-center py-4 rounded-lg mb-6 ${
              isExpired ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <div className={`text-3xl font-mono font-bold ${
                isExpired ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {formatTime(timeRemaining)}
              </div>
              <p className={`text-sm mt-2 ${
                isExpired ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {isExpired ? 'Session ended' : 'Time remaining'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!isExpired ? (
                <>
                  <button
                    onClick={extendSession}
                    disabled={isExtending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                  >
                    {isExtending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Extending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Extend Session
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleTimeout}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleTimeout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Login Again
                </button>
              )}
            </div>

            {/* Additional Info */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              {enableActivityTracking && (
                <p>Your session will be automatically extended when you use the application.</p>
              )}
              {!isExpired && (
                <p className="mt-1">You will be automatically logged out when the timer reaches zero.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionTimeoutManager;
