'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command as CommandIcon } from 'lucide-react';
import { filterCommands } from './fuzzySearch';
import { CommandPaletteContext } from './CommandPaletteContext';
import type { Command, CommandGroup, CommandPaletteProps } from './types';

const listboxId = 'command-palette-listbox';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  groups: groupsProp,
  placeholder = 'Type a command or search...',
  emptyMessage = 'No results found.',
  className = '',
}) => {
  const ctx = useContext(CommandPaletteContext);
  const allGroups = groupsProp ?? ctx?.groups ?? [];
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Flatten groups into a list of filtered items with group metadata
  const filteredItems = useMemo(() => {
    const items: { group: CommandGroup; command: Command }[] = [];

    for (const group of allGroups) {
      const filtered = filterCommands(query, group.commands);
      if (filtered.length > 0) {
        items.push(...filtered.map((command) => ({ group, command })));
      }
    }

    return items;
  }, [allGroups, query]);

  // Group the filtered items back by group for display
  const displayGroups = useMemo(() => {
    const map = new Map<string, { group: CommandGroup; commands: Command[] }>();

    for (const item of filteredItems) {
      const existing = map.get(item.group.id);
      if (existing) {
        existing.commands.push(item.command);
      } else {
        map.set(item.group.id, { group: item.group, commands: [item.command] });
      }
    }

    return Array.from(map.values());
  }, [filteredItems]);

  const totalResults = filteredItems.length;

  // Reset active index and query when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after animation
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current.get(activeIndex);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Global keyboard shortcut to open (Cmd/Ctrl + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          ctx?.open();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, ctx]);

  const executeCommand = useCallback(
    (command: Command) => {
      if (command.disabled) return;
      onClose();
      // Execute on next tick so the palette closes first
      requestAnimationFrame(() => {
        command.action();
      });
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % Math.max(totalResults, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev === 0 ? Math.max(totalResults - 1, 0) : prev - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[activeIndex]) {
            executeCommand(filteredItems[activeIndex].command);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(Math.max(totalResults - 1, 0));
          break;
      }
    },
    [activeIndex, totalResults, filteredItems, executeCommand, onClose]
  );

  const getOptionId = (index: number) => `command-palette-option-${index}`;

  // Build a flat list of all command IDs for aria-activedescendant
  const activeId = filteredItems[activeIndex]
    ? getOptionId(activeIndex)
    : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[10000] ${className}`}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="absolute inset-0 flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onKeyDown={handleKeyDown}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)]">
                <Search
                  className="w-5 h-5 text-[var(--text-muted)] shrink-0"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-controls={listboxId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  aria-label="Search commands"
                  className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm outline-none"
                />
                <button
                  onClick={onClose}
                  className="p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
                  aria-label="Close command palette"
                >
                  <kbd className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded">
                    esc
                  </kbd>
                </button>
              </div>

              {/* Results */}
              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Commands"
                className="max-h-80 overflow-y-auto py-2"
              >
                {totalResults === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    {emptyMessage}
                  </div>
                ) : (
                  displayGroups.map((group) => (
                    <div key={group.group.id} role="group" aria-labelledby={`group-${group.group.id}`}>
                      <div
                        id={`group-${group.group.id}`}
                        className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                      >
                        {group.group.label}
                      </div>
                      {group.commands.map((command) => {
                        const globalIdx = filteredItems.findIndex(
                          (item) => item.command.id === command.id
                        );
                        const isActive = globalIdx === activeIndex;

                        return (
                          <div
                            key={command.id}
                            ref={(el) => {
                              if (el) itemRefs.current.set(globalIdx, el);
                            }}
                            id={getOptionId(globalIdx)}
                            role="option"
                            aria-selected={isActive}
                            aria-disabled={command.disabled}
                            data-command-id={command.id}
                            className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-[var(--radius-md)] cursor-pointer text-sm transition-colors ${
                              isActive
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                            } ${command.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            onClick={() => executeCommand(command)}
                          >
                            {command.icon && (
                              <span
                                className={`shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`}
                                aria-hidden="true"
                              >
                                {command.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{command.label}</div>
                              {command.description && (
                                <div
                                  className={`truncate text-xs mt-0.5 ${
                                    isActive ? 'text-white/70' : 'text-[var(--text-muted)]'
                                  }`}
                                >
                                  {command.description}
                                </div>
                              )}
                            </div>
                            {command.shortcut && (
                              <div className="flex items-center gap-1 shrink-0">
                                {command.shortcut.map((key, i) => (
                                  <kbd
                                    key={i}
                                    className={`min-w-[22px] px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border ${
                                      isActive
                                        ? 'bg-white/20 border-white/30 text-white'
                                        : 'bg-[var(--surface-elevated)] border-[var(--border-default)] text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {key}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-muted)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded font-mono">
                      &uarr;&darr;
                    </kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded font-mono">
                      &crarr;
                    </kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded font-mono">
                      esc
                    </kbd>
                    close
                  </span>
                </div>
                <span>
                  <CommandIcon className="w-3 h-3 inline" /> + K
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
