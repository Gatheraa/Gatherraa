import { useRole, UserRole } from '../components/dao/RoleContext';

/**
 * Convenience hook — use this in pages/components instead of useRole directly.
 */
export function useAuth() {
  const { role, address, isAuthenticated, setRole, setAddress, hasRole } = useRole();
  const user = isAuthenticated && role ? { role, address } : null;
  const status = isAuthenticated ? 'authenticated' : 'unauthenticated';
  const isLoading = false;

  /** Call this after wallet connection + on-chain role resolution */
  function login(walletAddress: string, resolvedRole: UserRole) {
    setAddress(walletAddress);
    setRole(resolvedRole);
  }

  function logout() {
    setAddress(null);
    setRole(null);
    sessionStorage.clear();
  }

  return {
    user,
    status,
    isLoading,
    role,
    address,
    isAuthenticated,
    isAdmin: hasRole('admin'),
    isCreator: hasRole('creator', 'admin'),     // admins can do creator things too
    isContributor: hasRole('contributor', 'creator', 'admin'),
    login,
    logout,
  };
}