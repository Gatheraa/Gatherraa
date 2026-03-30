'use client';

import Link from 'next/link';
import { CalendarDays, LayoutDashboard, Plus, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FloatingActionItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface FloatingActionButtonProps {
  actions?: FloatingActionItem[];
  expandable?: boolean;
}

const defaultActions: FloatingActionItem[] = [
  {
    id: 'events',
    label: 'Browse Events',
    href: '/events',
    icon: <CalendarDays className="h-4 w-4" aria-hidden />,
  },
  {
    id: 'dashboard',
    label: 'Open Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
  },
  {
    id: 'profile',
    label: 'View Profile',
    href: '/profile',
    icon: <UserRound className="h-4 w-4" aria-hidden />,
  },
];

export function FloatingActionButton({
  actions = defaultActions,
  expandable = true,
}: FloatingActionButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const normalizedActions = useMemo(() => actions.slice(0, 4), [actions]);
  const primaryAction = normalizedActions[0];

  if (normalizedActions.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 sm:bottom-8 sm:right-8">
      {expandable && (
        <ul
          className={`mb-3 flex flex-col items-end gap-2 transition-all duration-300 ease-out motion-reduce:transition-none ${
            isOpen
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-3 scale-95 opacity-0'
          }`}
          aria-hidden={!isOpen}
        >
          {normalizedActions.map((action, index) => (
            <li
              key={action.id}
              style={{ transitionDelay: isOpen ? `${index * 35}ms` : '0ms' }}
              className="transition-all duration-300 ease-out"
            >
              <Link
                href={action.href}
                className="pointer-events-auto flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-overlay)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-lg shadow-black/10 transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
                onClick={() => setIsOpen(false)}
                aria-label={action.label}
              >
                <span className="rounded-full bg-[var(--color-primary-muted)] p-1 text-[var(--color-primary)]">
                  {action.icon}
                </span>
                <span>{action.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-xl shadow-blue-900/25 transition-all duration-300 ease-out hover:scale-105 hover:bg-[var(--color-primary-hover)] active:scale-95"
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={expandable ? isOpen : undefined}
        onClick={() => {
          if (expandable) {
            setIsOpen((previous) => !previous);
            return;
          }

          router.push(primaryAction.href);
        }}
      >
        <Plus
          className={`h-6 w-6 transition-transform duration-300 ease-out ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
          aria-hidden
        />
      </button>
    </div>
  );
}