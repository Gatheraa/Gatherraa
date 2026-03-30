"use client";

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, HelpCircle, Keyboard, X, ShieldCheck } from 'lucide-react';

interface ShortcutGroup {
  name: string;
  shortcuts: Shortcut[];
}

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

interface KeyboardNavigatorProps {
  shortcuts?: ShortcutGroup[];
  className?: string;
  showHelperKey?: string; // key to show shortcut helper (default '?' or '/h')
}

const DEFAULT_SHORTCUTS: ShortcutGroup[] = [
  {
    name: "Navigation",
    shortcuts: [
      { key: 'h', alt: true, description: 'Go to Dashboard', action: () => console.log('Dashboard') },
      { key: 'e', alt: true, description: 'View All Events', action: () => console.log('Events') },
      { key: 'p', alt: true, description: 'View Profile', action: () => console.log('Profile') },
    ]
  },
  {
    name: "Actions",
    shortcuts: [
      { key: 'n', ctrl: true, description: 'Create New Event', action: () => console.log('New Event') },
      { key: '/', description: 'Quick Search', action: () => console.log('Search') },
      { key: 's', ctrl: true, description: 'Save Changes', action: () => console.log('Save') },
    ]
  }
];

const KeyboardNavigator: React.FC<KeyboardNavigatorProps> = ({
  shortcuts = DEFAULT_SHORTCUTS,
  className = '',
  showHelperKey = '?',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const registeredShortcuts = useRef<Shortcut[]>([]);

  // Collect all shortcuts from all groups
  useEffect(() => {
    registeredShortcuts.current = shortcuts.flatMap(group => group.shortcuts);
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // If typing in an input or textarea, don't trigger shortcuts unless they use modifiers
    const isEditing = 
      document.activeElement instanceof HTMLInputElement || 
      document.activeElement instanceof HTMLTextAreaElement || 
      (document.activeElement as HTMLElement)?.isContentEditable;

    // Handle helper toggle
    if (event.key === showHelperKey && !isEditing) {
      setIsOpen(prev => !prev);
      return;
    }

    if (isOpen && event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    // Find matching shortcut
    const match = registeredShortcuts.current.find(s => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = !!s.ctrl === event.ctrlKey;
      const altMatch = !!s.alt === event.altKey;
      const shiftMatch = !!s.shift === event.shiftKey;
      const metaMatch = !!s.meta === event.metaKey;

      // Special case: if isEditing, only allow shortcuts with modifiers
      if (isEditing && !s.ctrl && !s.alt && !s.meta) return false;

      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
    });

    if (match) {
      event.preventDefault();
      match.action();
    }
  }, [isOpen, showHelperKey]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderKey = (shortcut: Shortcut) => {
    const keys = [];
    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.alt) keys.push('Alt');
    if (shortcut.shift) keys.push('Shift');
    if (shortcut.meta) keys.push('⌘');
    keys.push(shortcut.key.toUpperCase());
    
    return (
      <div className="flex items-center gap-1">
        {keys.map((k, idx) => (
          <React.Fragment key={idx}>
            <kbd className="min-w-[24px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-950 font-sans font-bold text-[10px] text-gray-700 dark:text-gray-300 rounded shadow-sm">
              {k}
            </kbd>
            {idx < keys.length - 1 && <span className="text-[10px] text-gray-400 font-bold">+</span>}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-gray-900/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className={`w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[32px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden ${className}`}
          >
            {/* Header */}
            <div className="px-8 py-6 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Keyboard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">Command Center</h3>
                  <p className="text-xs text-indigo-100 opacity-80 uppercase tracking-widest font-bold">Keyboard Shortcuts</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {shortcuts.map((group, groupIdx) => (
                  <div key={groupIdx}>
                    <h4 className="flex items-center gap-2 text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
                      <span className="w-1 h-3 bg-indigo-500 rounded-full" />
                      {group.name}
                    </h4>
                    <div className="space-y-4">
                      {group.shortcuts.map((shortcut, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between group">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {shortcut.description}
                          </span>
                          {renderKey(shortcut)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-indigo-500/50" />
                Security First Hub
              </div>
              <div className="text-[10px] text-gray-500 italic">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200">Esc</kbd> to close
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export { KeyboardNavigator };
export type { KeyboardNavigatorProps, Shortcut, ShortcutGroup };
