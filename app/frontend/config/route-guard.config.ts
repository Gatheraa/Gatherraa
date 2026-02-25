/**
 * config/route-guard.config.ts
 * Gatheraa — Issue #105: Route Guarding & Pre-Fetch Security Layer
 *
 * Single source of truth for all route protection rules.
 * Consumed by middleware.ts, RouteGuard component, and auth utilities.
 */

export type UserRole = 'guest' | 'user' | 'organizer' | 'admin';

export interface RouteRule {
  /** Minimum role required to access this path */
  requiredRole: UserRole;
  /** Where to redirect if auth fails */
  redirectTo: string;
  /** Where to redirect if role is insufficient (but user IS authed) */
  insufficientRoleRedirect?: string;
  /** If true, authed users are redirected away (e.g. /login) */
  redirectIfAuthed?: string;
  /** Show this skeleton variant while checking auth */
  skeletonVariant?: 'dashboard' | 'event' | 'profile' | 'generic';
  /** Custom page title for error states */
  label?: string;
}

/** Role hierarchy — higher index = more access */
export const ROLE_HIERARCHY: UserRole[] = ['guest', 'user', 'organizer', 'admin'];

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

/**
 * Route protection rules.
 * Keys are path prefixes — most specific match wins.
 */
export const ROUTE_RULES: Record<string, RouteRule> = {
  // ── Auth pages — redirect authed users away ──────────────────────────────
  '/login': {
    requiredRole: 'guest',
    redirectTo: '/',
    redirectIfAuthed: '/dashboard',
    label: 'Login',
  },
  '/register': {
    requiredRole: 'guest',
    redirectTo: '/',
    redirectIfAuthed: '/dashboard',
    label: 'Register',
  },

  // ── Authenticated user routes ────────────────────────────────────────────
  '/dashboard': {
    requiredRole: 'user',
    redirectTo: '/login',
    skeletonVariant: 'dashboard',
    label: 'Dashboard',
  },
  '/profile': {
    requiredRole: 'user',
    redirectTo: '/login',
    skeletonVariant: 'profile',
    label: 'Profile',
  },
  '/tickets': {
    requiredRole: 'user',
    redirectTo: '/login',
    skeletonVariant: 'generic',
    label: 'My Tickets',
  },

  // ── Organizer routes ─────────────────────────────────────────────────────
  '/events/create': {
    requiredRole: 'organizer',
    redirectTo: '/login',
    insufficientRoleRedirect: '/dashboard?upgrade=organizer',
    skeletonVariant: 'event',
    label: 'Create Event',
  },
  '/events/manage': {
    requiredRole: 'organizer',
    redirectTo: '/login',
    insufficientRoleRedirect: '/dashboard?upgrade=organizer',
    skeletonVariant: 'event',
    label: 'Manage Events',
  },

  // ── Admin routes ─────────────────────────────────────────────────────────
  '/admin': {
    requiredRole: 'admin',
    redirectTo: '/login',
    insufficientRoleRedirect: '/dashboard',
    skeletonVariant: 'dashboard',
    label: 'Admin Panel',
  },
};

/**
 * Find the most-specific matching rule for a given pathname.
 * e.g. '/events/create/step-2' matches '/events/create' before '/events'
 */
export function matchRouteRule(pathname: string): RouteRule | null {
  const sorted = Object.keys(ROUTE_RULES).sort((a, b) => b.length - a.length);
  const match = sorted.find(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? ROUTE_RULES[match] : null;
}

/** Public routes — never intercepted */
export const PUBLIC_PATHS = ['/', '/events', '/about', '/faq', '/_next', '/api/health', '/favicon'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}