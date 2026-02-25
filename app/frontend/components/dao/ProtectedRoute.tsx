import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRole, UserRole } from './RoleContext';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Wraps a route and redirects unauthenticated or unauthorized users.
 *
 * Usage in router:
 *   <Route path="/dao/create" element={
 *     <ProtectedRoute allowedRoles={['admin']}>
 *       <DAOCreationPage />
 *     </ProtectedRoute>
 *   } />
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  redirectTo = '/login',
  children,
}) => {
  const { isAuthenticated, hasRole } = useRole();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};