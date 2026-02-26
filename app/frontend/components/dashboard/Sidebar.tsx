'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  BarChart3,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
}

export interface SidebarSection {
  id: string;
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections?: SidebarSection[];
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  activeItemId?: string;
  onItemClick?: (itemId: string) => void;
  className?: string;
}

const defaultSections: SidebarSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { id: 'home', label: 'Home', icon: Home, href: '/' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3, href: '/dashboard/analytics' },
      { id: 'transactions', label: 'Transactions', icon: TrendingUp, href: '/dashboard/transactions', badge: 12 },
      { id: 'reports', label: 'Reports', icon: PieChart, href: '/dashboard/reports' },
    ],
  },
  {
    id: 'management',
    title: 'Management',
    items: [
      { id: 'users', label: 'Users', icon: Users, href: '/dashboard/users' },
      { id: 'events', label: 'Events', icon: Calendar, href: '/dashboard/events' },
      { id: 'payments', label: 'Payments', icon: CreditCard, href: '/dashboard/payments' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard/settings' },
      { id: 'help', label: 'Help Center', icon: HelpCircle, href: '/dashboard/help' },
    ],
  },
];

export function Sidebar({
  sections = defaultSections,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  activeItemId,
  onItemClick,
  className = '',
}: SidebarProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [mounted, setMounted] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const toggleExpanded = useCallback(() => {
    const newValue = !isExpanded;
    setInternalExpanded(newValue);
    onExpandedChange?.(newValue);
  }, [isExpanded, onExpandedChange]);

  const handleItemClick = useCallback((itemId: string) => {
    onItemClick?.(itemId);
  }, [onItemClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleItemClick(itemId);
    }
  }, [handleItemClick]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <aside
        className={`flex flex-col bg-surface border-r border-border-default transition-all duration-300 ${
          isExpanded ? 'w-64' : 'w-16'
        } ${className}`}
        aria-label="Sidebar"
      />
    );
  }

  return (
    <aside
      className={`flex flex-col bg-surface border-r border-border-default transition-all duration-300 ease-out ${
        isExpanded ? 'w-64' : 'w-16'
      } ${className}`}
      aria-label="Sidebar"
      role="navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border-default">
        <div
          className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${
            isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="font-semibold text-text-primary whitespace-nowrap">Gatherraa</span>
        </div>
        <button
          onClick={toggleExpanded}
          className={`p-1.5 rounded-md hover:bg-surface-elevated transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            !isExpanded ? 'mx-auto' : ''
          }`}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          ) : (
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" role="menubar">
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {/* Section Title */}
            {section.title && isExpanded && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            {!isExpanded && section.title && (
              <div className="h-px mx-2 mb-2 bg-border-muted" />
            )}

            {/* Section Items */}
            <ul className="space-y-1" role="group" aria-label={section.title}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeItemId === item.id;
                const isHovered = hoveredItemId === item.id;

                return (
                  <li key={item.id} role="none">
                    <button
                      onClick={() => handleItemClick(item.id)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'bg-primary text-white shadow-md'
                          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      } ${
                        isHovered && !isActive
                          ? 'transform scale-[1.02] translate-x-1'
                          : ''
                      }`}
                      role="menuitem"
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                      tabIndex={0}
                    >
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          isActive
                            ? 'text-white'
                            : isHovered
                            ? 'transform scale-110'
                            : ''
                        }`}
                      />
                      <span
                        className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${
                          isExpanded
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 -translate-x-2 w-0'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge && isExpanded && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-primary text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {/* Active indicator dot when collapsed */}
                      {!isExpanded && (
                        <span
                          className={`absolute left-0 w-1 h-8 rounded-r-full transition-all duration-200 ${
                            isActive
                              ? 'bg-primary'
                              : isHovered
                              ? 'bg-primary/50'
                              : 'bg-transparent'
                          }`}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t border-border-default transition-all duration-300 ${
        isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 p-0 overflow-hidden'
      }`}>
        <div className="p-3 rounded-lg bg-surface-elevated">
          <p className="text-sm font-medium text-text-primary">Need help?</p>
          <p className="text-xs text-text-muted mt-1">Check our documentation</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
