import React from 'react';
import { useRole, UserRole } from './RoleContext';

interface RoleGateProps {
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user's role is in allowedRoles.
 * Usage:
 *   <RoleGate allowedRoles={['creator', 'admin']}>
 *     <CreateMissionButton />
 *   </RoleGate>
 */
export const RoleGate: React.FC<RoleGateProps> = ({
  allowedRoles,
  fallback = null,
  children,
}) => {
  const { hasRole, isAuthenticated } = useRole();

  if (!isAuthenticated) return <>{fallback}</>;
  if (!hasRole(...allowedRoles)) return <>{fallback}</>;

  return <>{children}</>;
};