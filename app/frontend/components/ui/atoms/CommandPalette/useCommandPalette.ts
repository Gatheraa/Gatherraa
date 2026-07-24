'use client';

import { useContext } from 'react';
import { CommandPaletteContext } from './CommandPaletteContext';
import type { CommandGroup } from './types';

interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  register: (group: CommandGroup) => void;
  unregister: (groupId: string) => void;
  groups: CommandGroup[];
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return {
    isOpen: ctx.isOpen,
    open: ctx.open,
    close: ctx.close,
    toggle: ctx.toggle,
    register: ctx.register,
    unregister: ctx.unregister,
    groups: ctx.groups,
  };
}
