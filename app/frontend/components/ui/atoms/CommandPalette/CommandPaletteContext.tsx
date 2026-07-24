'use client';

import React, { createContext, useCallback, useMemo, useRef, useState } from 'react';
import type { CommandGroup, CommandPaletteContextValue } from './types';

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

interface CommandPaletteProviderProps {
  children: React.ReactNode;
  initialGroups?: CommandGroup[];
}

export const CommandPaletteProvider: React.FC<CommandPaletteProviderProps> = ({
  children,
  initialGroups = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const groupsRef = useRef<CommandGroup[]>(initialGroups);
  const [, forceUpdate] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const register = useCallback((group: CommandGroup) => {
    groupsRef.current = groupsRef.current.filter((g) => g.id !== group.id);
    groupsRef.current = [...groupsRef.current, group];
    forceUpdate((n) => n + 1);
  }, []);

  const unregister = useCallback((groupId: string) => {
    groupsRef.current = groupsRef.current.filter((g) => g.id !== groupId);
    forceUpdate((n) => n + 1);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      register,
      unregister,
      get groups() {
        return groupsRef.current;
      },
    }),
    [isOpen, open, close, toggle, register, unregister]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
};
