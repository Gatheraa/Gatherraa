import { ReactNode } from 'react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string[];
  icon?: ReactNode;
  keywords?: string[];
  action: () => void;
  disabled?: boolean;
}

export interface CommandGroup {
  id: string;
  label: string;
  commands: Command[];
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  groups?: CommandGroup[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  register: (group: CommandGroup) => void;
  unregister: (groupId: string) => void;
  groups: CommandGroup[];
}
