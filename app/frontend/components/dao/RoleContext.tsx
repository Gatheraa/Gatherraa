import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'creator' | 'contributor' | 'admin' | null;

interface RoleContextValue {
  role: UserRole;
  address: string | null;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  setAddress: (address: string | null) => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(null);
  const [address, setAddress] = useState<string | null>(null);

  const isAuthenticated = !!address;

  const hasRole = (...roles: UserRole[]) => roles.includes(role);

  // On mount, restore from session (replace with your real auth source)
  useEffect(() => {
    const savedRole = sessionStorage.getItem('userRole') as UserRole;
    const savedAddress = sessionStorage.getItem('userAddress');
    if (savedRole) setRole(savedRole);
    if (savedAddress) setAddress(savedAddress);
  }, []);

  useEffect(() => {
    if (role) sessionStorage.setItem('userRole', role);
    if (address) sessionStorage.setItem('userAddress', address);
  }, [role, address]);

  return (
    <RoleContext.Provider value={{ role, address, isAuthenticated, setRole, setAddress, hasRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
};