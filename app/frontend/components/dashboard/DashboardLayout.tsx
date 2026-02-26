'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type SidebarProps, type SidebarItem } from './Sidebar';
import { Bell, Search, Menu, X, User, Settings, LogOut, ChevronDown } from 'lucide-react';

export interface NavbarAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  badge?: number;
}

export interface NavbarUser {
  name: string;
  email?: string;
  avatar?: string;
  initials?: string;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebarProps?: SidebarProps;
  navbarTitle?: string;
  navbarActions?: NavbarAction[];
  navbarUser?: NavbarUser;
  onUserMenuClick?: (action: string) => void;
  defaultSidebarExpanded?: boolean;
  showNavbar?: boolean;
  className?: string;
}

export function DashboardLayout({
  children,
  sidebarProps,
  navbarTitle = 'Dashboard',
  navbarActions = [],
  navbarUser,
  onUserMenuClick,
  defaultSidebarExpanded = true,
  showNavbar = true,
  className = '',
}: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(defaultSidebarExpanded);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle responsive breakpoint
  useEffect(() => {
    setMounted(true);
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarExpanded(false);
      } else {
        setSidebarExpanded(defaultSidebarExpanded);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [defaultSidebarExpanded]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setUserMenuOpen(false);
      setMobileMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSidebarToggle = useCallback((expanded: boolean) => {
    setSidebarExpanded(expanded);
  }, []);

  const handleUserAction = useCallback((action: string) => {
    setUserMenuOpen(false);
    onUserMenuClick?.(action);
  }, [onUserMenuClick]);

  // Prevent flash of unstyled content
  if (!mounted) {
    return (
      <div className="flex h-screen bg-background">
        <div className={`w-16 flex-shrink-0 bg-surface border-r border-border-default`} />
        <div className="flex-1 flex flex-col">
          <header className="h-16 bg-surface border-b border-border-default" />
          <main className="flex-1 p-6 bg-background" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-background overflow-hidden ${className}`}>
      {/* Mobile Overlay */}
      {mobileMenuOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative z-50 h-full
          transition-all duration-300 ease-out
          ${isMobile ? 'top-0 left-0' : ''}
          ${mobileMenuOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'}
          ${isMobile ? 'w-64' : ''}
        `}
      >
        <Sidebar
          {...sidebarProps}
          expanded={sidebarExpanded}
          onExpandedChange={handleSidebarToggle}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar */}
        {showNavbar && (
          <header className="flex-shrink-0 h-16 bg-surface border-b border-border-default">
            <div className="flex items-center justify-between h-full px-4 md:px-6">
              {/* Left: Menu button (mobile) and Title */}
              <div className="flex items-center gap-4">
                {isMobile && (
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 rounded-lg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={mobileMenuOpen}
                  >
                    {mobileMenuOpen ? (
                      <X className="w-5 h-5 text-text-secondary" />
                    ) : (
                      <Menu className="w-5 h-5 text-text-secondary" />
                    )}
                  </button>
                )}
                <h1 className="text-lg font-semibold text-text-primary">
                  {navbarTitle}
                </h1>
              </div>

              {/* Center: Search (desktop only) */}
              <div className="hidden md:flex flex-1 max-w-md mx-8">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="search"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    aria-label="Search"
                  />
                </div>
              </div>

              {/* Right: Actions and User Menu */}
              <div className="flex items-center gap-2">
                {/* Navbar Actions */}
                {navbarActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.onClick}
                      className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={action.label}
                    >
                      <Icon className="w-5 h-5 text-text-secondary" />
                      {action.badge !== undefined && action.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-error text-white text-xs font-medium rounded-full">
                          {action.badge > 9 ? '9+' : action.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* User Menu */}
                {navbarUser && (
                  <div className="relative ml-2" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="User menu"
                      aria-expanded={userMenuOpen}
                      aria-haspopup="true"
                    >
                      {navbarUser.avatar ? (
                        <img
                          src={navbarUser.avatar}
                          alt={navbarUser.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {navbarUser.initials || navbarUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-surface rounded-xl border border-border-default shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                        <div className="p-3 border-b border-border-default">
                          <p className="font-medium text-text-primary">{navbarUser.name}</p>
                          {navbarUser.email && (
                            <p className="text-sm text-text-muted">{navbarUser.email}</p>
                          )}
                        </div>
                        <div className="p-2">
                          <button
                            onClick={() => handleUserAction('profile')}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary rounded-lg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <User className="w-4 h-4" />
                            Profile
                          </button>
                          <button
                            onClick={() => handleUserAction('settings')}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary rounded-lg hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Settings className="w-4 h-4" />
                            Settings
                          </button>
                          <div className="my-1 border-t border-border-default" />
                          <button
                            onClick={() => handleUserAction('logout')}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error rounded-lg hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <LogOut className="w-4 h-4" />
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
