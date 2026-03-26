'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Shield, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface UserRole {
  id: string;
  roles: string[];
  permissions?: string[];
  lastUpdated?: number;
}

export interface RoleGateProps {
  /** Array of allowed roles */
  allowedRoles: string[];
  /** Array of required permissions (optional) */
  requiredPermissions?: string[];
  /** Current user roles */
  userRoles?: string[];
  /** Current user permissions */
  userPermissions?: string[];
  /** Fallback component to show when unauthorized */
  fallback?: React.ReactNode;
  /** Loading component to show while checking */
  loadingComponent?: React.ReactNode;
  /** Custom unauthorized message */
  unauthorizedMessage?: string;
  /** Custom unauthorized description */
  unauthorizedDescription?: string;
  /** Show role information in unauthorized state */
  showRoleInfo?: boolean;
  /** Enable strict mode (all roles must match) */
  strictMode?: boolean;
  /** Custom role checking function */
  roleChecker?: (userRoles: string[], allowedRoles: string[]) => boolean;
  /** Render prop pattern */
  children: React.ReactNode | ((hasAccess: boolean) => React.ReactNode);
  /** Custom class names */
  className?: string;
  /** Log access attempts */
  logAccess?: boolean;
  /** Cache role check results */
  cacheResults?: boolean;
}

interface RoleGateContext {
  hasAccess: boolean;
  userRoles: string[];
  userPermissions: string[];
  checkAccess: (roles: string[], permissions?: string[]) => boolean;
}

const RoleGateContext = createContext<RoleGateContext | null>(null);

export const useRoleGate = () => {
  const context = useContext(RoleGateContext);
  if (!context) {
    throw new Error('useRoleGate must be used within a RoleGateProvider');
  }
  return context;
};

export const RoleGateProvider: React.FC<{ children: React.ReactNode; userRoles: string[]; userPermissions?: string[] }> = ({
  children,
  userRoles,
  userPermissions = [],
}) => {
  const checkAccess = (roles: string[], permissions?: string[]) => {
    return roles.some(role => userRoles.includes(role)) &&
           (!permissions || permissions.every(perm => userPermissions.includes(perm)));
  };

  const hasAccess = checkAccess(userRoles);

  return (
    <RoleGateContext.Provider value={{ hasAccess, userRoles, userPermissions, checkAccess }}>
      {children}
    </RoleGateContext.Provider>
  );
};

const RoleGate = React.forwardRef<HTMLDivElement, RoleGateProps>(
  (
    {
      allowedRoles,
      requiredPermissions,
      userRoles: externalUserRoles,
      userPermissions: externalUserPermissions,
      fallback,
      loadingComponent,
      unauthorizedMessage,
      unauthorizedDescription,
      showRoleInfo = true,
      strictMode = false,
      roleChecker,
      children,
      className = '',
      logAccess = false,
      cacheResults = true,
      ...props
    },
    ref
  ) => {
    const context = useContext(RoleGateContext);
    const userRoles = externalUserRoles ?? context?.userRoles ?? [];
    const userPermissions = externalUserPermissions ?? context?.userPermissions ?? [];
    const [isChecking, setIsChecking] = useState(false);
    const [accessResult, setAccessResult] = useState<boolean | null>(null);
    const [cachedResults, setCachedResults] = useState<Map<string, boolean>>(new Map());

    // Check access permissions
    const checkAccess = useCallback((roles: string[], permissions?: string[]): boolean => {
      const cacheKey = `${roles.join(',')}-${permissions?.join(',') || ''}`;
      
      if (cacheResults && cachedResults.has(cacheKey)) {
        return cachedResults.get(cacheKey)!;
      }

      let hasAccess = false;

      if (roleChecker) {
        hasAccess = roleChecker(roles, allowedRoles);
      } else if (strictMode) {
        // Strict mode: user must have ALL allowed roles
        hasAccess = allowedRoles.every(role => roles.includes(role));
      } else {
        // Default mode: user must have ANY of the allowed roles
        hasAccess = roles.some(role => allowedRoles.includes(role));
      }

      // Check permissions if specified
      if (hasAccess && requiredPermissions && requiredPermissions.length > 0) {
        hasAccess = requiredPermissions.every(perm => 
          userPermissions.includes(perm) || roles.some(role => 
            context?.checkAccess([role], [perm]) || false
          )
        );
      }

      if (cacheResults) {
        const newCachedResults = new Map(cachedResults);
        newCachedResults.set(cacheKey, hasAccess);
        setCachedResults(newCachedResults);
      }

      if (logAccess) {
        console.log('RoleGate Access Check:', {
          userRoles: roles,
          userPermissions,
          allowedRoles,
          requiredPermissions,
          hasAccess,
          timestamp: new Date().toISOString(),
        });
      }

      return hasAccess;
    }, [allowedRoles, requiredPermissions, strictMode, roleChecker, userPermissions, cacheResults, cachedResults, logAccess]);

    useEffect(() => {
      setIsChecking(true);
      const result = checkAccess(userRoles, requiredPermissions);
      setAccessResult(result);
      setIsChecking(false);
    }, [userRoles, allowedRoles, requiredPermissions, checkAccess]);

    const hasAccess = accessResult ?? false;

    // Handle render prop pattern
    if (typeof children === 'function') {
      return (
        <div ref={ref} className={className} {...props}>
          {(children as (hasAccess: boolean) => React.ReactNode)(hasAccess)}
        </div>
      );
    }

    // Show loading component while checking
    if (isChecking && loadingComponent) {
      return (
        <div ref={ref} className={className} {...props}>
          {loadingComponent}
        </div>
      );
    }

    // Show children if access is granted
    if (hasAccess) {
      return (
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      );
    }

    // Show fallback component if provided
    if (fallback) {
      return (
        <div ref={ref} className={className} {...props}>
          {fallback}
        </div>
      );
    }

    // Default unauthorized UI
    return (
      <div ref={ref} className={`role-gate-unauthorized ${className}`.trim()} {...props}>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4">
            <Lock size={48} className="text-[var(--color-warning)] mx-auto" />
          </div>
          
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {unauthorizedMessage || 'Access Denied'}
          </h3>
          
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            {unauthorizedDescription || 'You don\'t have the required permissions to access this content.'}
          </p>

          {showRoleInfo && (
            <div className="bg-[var(--surface)] border border-[var(--border-default)] rounded-lg p-4 max-w-md w-full">
              <h4 className="font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Shield size={16} />
                Required Access
              </h4>
              
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-[var(--text-primary)] mb-2">Required Roles:</h5>
                  <div className="flex flex-wrap gap-2">
                    {allowedRoles.map(role => (
                      <span 
                        key={role}
                        className="px-3 py-1 bg-[var(--color-error)] bg-opacity-10 text-[var(--color-error)] rounded-full text-sm font-medium"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                {requiredPermissions && requiredPermissions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-[var(--text-primary)] mb-2">Required Permissions:</h5>
                    <div className="flex flex-wrap gap-2">
                      {requiredPermissions.map(permission => (
                        <span 
                          key={permission}
                          className="px-3 py-1 bg-[var(--color-warning)] bg-opacity-10 text-[var(--color-warning)] rounded-full text-sm font-medium"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="text-sm font-medium text-[var(--text-primary)] mb-2">Your Current Roles:</h5>
                  <div className="flex flex-wrap gap-2">
                    {userRoles.length > 0 ? (
                      userRoles.map(role => (
                        <span 
                          key={role}
                          className="px-3 py-1 bg-[var(--surface)] border border-[var(--border-default)] rounded-full text-sm"
                        >
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-[var(--text-muted)] text-sm">No roles assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-[var(--text-muted)]">
            <p>If you believe this is an error, please contact your administrator.</p>
          </div>
        </div>
      </div>
    );
  }
);

RoleGate.displayName = 'RoleGate';

// Higher-order component for easy integration
export const withRoleGate = <P extends object>(
  allowedRoles: string[],
  requiredPermissions?: string[],
  options?: Partial<Omit<RoleGateProps, 'allowedRoles' | 'requiredPermissions' | 'children'>>
) => {
  return (WrappedComponent: React.ComponentType<P>) => {
    const WithRoleGateComponent = (props: P) => (
      <RoleGate
        allowedRoles={allowedRoles}
        requiredPermissions={requiredPermissions}
        {...options}
      >
        <WrappedComponent {...props} />
      </RoleGate>
    );

    WithRoleGateComponent.displayName = `withRoleGate(${WrappedComponent.displayName || WrappedComponent.name})`;
    return WithRoleGateComponent;
  };
};

// Predefined role constants
export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  PREMIUM_USER: 'premium_user',
  CONTENT_CREATOR: 'content_creator',
  EVENT_ORGANIZER: 'event_organizer',
  TICKET_SCANNER: 'ticket_scanner',
  ANALYST: 'analyst',
} as const;

export const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE_USERS: 'manage_users',
  MANAGE_CONTENT: 'manage_content',
  MANAGE_EVENTS: 'manage_events',
  VIEW_ANALYTICS: 'view_analytics',
  SCAN_TICKETS: 'scan_tickets',
  APPROVE_CONTENT: 'approve_content',
} as const;

// Utility functions
export const hasRole = (userRoles: string[], role: string): boolean => {
  return userRoles.includes(role);
};

export const hasAnyRole = (userRoles: string[], roles: string[]): boolean => {
  return roles.some(role => userRoles.includes(role));
};

export const hasAllRoles = (userRoles: string[], roles: string[]): boolean => {
  return roles.every(role => userRoles.includes(role));
};

export const hasPermission = (userPermissions: string[], permission: string): boolean => {
  return userPermissions.includes(permission);
};

export const hasAnyPermission = (userPermissions: string[], permissions: string[]): boolean => {
  return permissions.some(permission => userPermissions.includes(permission));
};

export { RoleGate };
export type { RoleGateProps, Role, UserRole };
