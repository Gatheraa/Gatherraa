'use client';
/**
 * components/auth/RouteGuard.tsx
 * Gatheraa — Issue #105: Client-side Route Guard + Skeleton Fallback
 *
 * Wraps any page component. Shows a skeleton (not a blank flash)
 * while auth resolves. Redirects when unauthorized.
 *
 * Usage:
 *   <RouteGuard requiredRole="organizer" skeleton="event">
 *     <CreateEventPage />
 *   </RouteGuard>
 */

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { UserRole, hasRole } from '@/config/route-guard.config';

// ─── Types ────────────────────────────────────────────────────────────────────

type SkeletonVariant = 'dashboard' | 'event' | 'profile' | 'generic';

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
  insufficientRoleRedirect?: string;
  skeleton?: SkeletonVariant;
  /** Custom fallback instead of built-in skeleton */
  fallback?: ReactNode;
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

const shimmer = {
  background: 'linear-gradient(90deg, #0f172a 25%, #1e293b 50%, #0f172a 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 8,
};

function SkeletonBlock({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #0f172a 25%, #1a2540 50%, #0f172a 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
    }} />
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock w={180} h={28} r={6} />
          <SkeletonBlock w={280} h={14} />
        </div>
        <SkeletonBlock w={100} h={36} r={10} />
      </div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: '#080e1a', border: '1px solid #0f1f35', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonBlock w={80} h={12} />
            <SkeletonBlock w={120} h={32} r={6} />
            <SkeletonBlock w="60%" h={10} />
          </div>
        ))}
      </div>
      {/* Table */}
      <div style={{ background: '#080e1a', border: '1px solid #0f1f35', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SkeletonBlock w={160} h={18} r={6} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <SkeletonBlock w={36} h={36} r={99} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock w="50%" h={12} />
              <SkeletonBlock w="30%" h={10} />
            </div>
            <SkeletonBlock w={80} h={28} r={8} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventSkeleton() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBlock w={140} h={14} />
        <SkeletonBlock w={260} h={32} r={6} />
        <SkeletonBlock w={320} h={13} />
      </div>
      <div style={{ background: '#080e1a', border: '1px solid #0f1f35', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {[1, 0.7, 0.9, 0.6].map((w, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonBlock w={100} h={10} />
            <SkeletonBlock w={`${w * 100}%`} h={42} r={10} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBlock w={80} h={10} />
              <SkeletonBlock h={42} r={10} />
            </div>
          ))}
        </div>
        <SkeletonBlock h={48} r={12} />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <SkeletonBlock w={72} h={72} r={99} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock w={160} h={22} r={6} />
          <SkeletonBlock w={220} h={13} />
          <SkeletonBlock w={90} h={26} r={20} />
        </div>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBlock w={100} h={10} />
          <SkeletonBlock h={42} r={10} />
        </div>
      ))}
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SkeletonBlock w={240} h={32} r={6} />
      <SkeletonBlock w="80%" h={14} />
      <SkeletonBlock w="60%" h={14} />
      {[0, 1, 2].map(i => (
        <div key={i} style={{ background: '#080e1a', border: '1px solid #0f1f35', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBlock w="40%" h={16} r={6} />
          <SkeletonBlock w="90%" h={12} />
          <SkeletonBlock w="70%" h={12} />
        </div>
      ))}
    </div>
  );
}

const SKELETONS: Record<SkeletonVariant, () => JSX.Element> = {
  dashboard: DashboardSkeleton,
  event: EventSkeleton,
  profile: ProfileSkeleton,
  generic: GenericSkeleton,
};

// ─── Unauthorized Screen ──────────────────────────────────────────────────────

function UnauthorizedScreen({ role }: { role?: UserRole }) {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>
        🔒
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
          Access Restricted
        </p>
        <p style={{ fontSize: 13, color: '#475569', maxWidth: 320, lineHeight: 1.6 }}>
          {role
            ? `This page requires ${role} access. Upgrade your account to continue.`
            : 'You must be signed in to view this page.'}
        </p>
      </div>
    </div>
  );
}

// ─── RouteGuard ───────────────────────────────────────────────────────────────

export default function RouteGuard({
  children,
  requiredRole = 'user',
  redirectTo = '/login',
  insufficientRoleRedirect,
  skeleton = 'generic',
  fallback,
}: RouteGuardProps) {
  const router = useRouter();
  const { user, status, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (status === 'unauthenticated') {
      const returnTo = encodeURIComponent(window.location.pathname);
      router.replace(`${redirectTo}?returnTo=${returnTo}`);
      return;
    }

    if (status === 'authenticated' && user && !hasRole(user.role, requiredRole)) {
      router.replace(insufficientRoleRedirect ?? redirectTo);
    }
  }, [status, user, isLoading, router, redirectTo, insufficientRoleRedirect, requiredRole]);

  // ── Auth resolving — show skeleton, never a flash ─────────────────────────
  if (isLoading || status === 'loading' || status === 'refreshing') {
    if (fallback) return <>{fallback}</>;
    const SkeletonComponent = SKELETONS[skeleton];
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div style={{ background: '#050a12', minHeight: '100vh' }}>
          <SkeletonComponent />
        </div>
      </>
    );
  }

  // ── Unauthenticated — show nothing while redirect fires ───────────────────
  if (status === 'unauthenticated') return null;

  // ── Wrong role — show restricted screen while redirect fires ─────────────
  if (user && !hasRole(user.role, requiredRole)) {
    return <UnauthorizedScreen role={requiredRole} />;
  }

  // ── Authorized ────────────────────────────────────────────────────────────
  return <>{children}</>;
}