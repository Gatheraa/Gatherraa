"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Shield,
  ShieldCheck,
  ShieldX,
  LogIn,
  UserX,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export type UserRole = "attendee" | "organizer" | "guest" | "none";

export interface AccessGateProps {
  requiredRole?: UserRole;
  children: React.ReactNode;
  onConnectWallet?: () => Promise<string | null>;
  onRedirect?: (path: string) => void;
  redirectPath?: string;
  fallback?: React.ReactNode;
}

interface WalletState {
  connected: boolean;
  address: string | null;
  role: UserRole;
  loading: boolean;
}

const roleConfig: Record<
  UserRole,
  { color: string; icon: React.ReactNode; label: string }
> = {
  attendee: {
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <ShieldCheck className="w-4 h-4" />,
    label: "Attendee",
  },
  organizer: {
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <Shield className="w-4 h-4" />,
    label: "Organizer",
  },
  guest: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Shield className="w-4 h-4" />,
    label: "Guest",
  },
  none: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <UserX className="w-4 h-4" />,
    label: "No Role",
  },
};

const roleHierarchy: Record<UserRole, number> = {
  none: 0,
  guest: 1,
  attendee: 2,
  organizer: 3,
};

const EventAccessGate: React.FC<AccessGateProps> = ({
  requiredRole = "attendee",
  children,
  onConnectWallet,
  onRedirect,
  redirectPath = "/connect",
  fallback,
}) => {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    role: "none",
    loading: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      setWallet((prev) => ({ ...prev, loading: true, error: null }));

      if (typeof window !== "undefined" && (window as any).stellar) {
        const publicKey = await (window as any).stellar.getPublicKey();
        const role = await fetchUserRole(publicKey);
        setWallet({
          connected: true,
          address: publicKey,
          role,
          loading: false,
        });
      } else {
        setWallet({
          connected: false,
          address: null,
          role: "none",
          loading: false,
        });
      }
    } catch (err) {
      setWallet({
        connected: false,
        address: null,
        role: "none",
        loading: false,
      });
    }
  };

  const fetchUserRole = async (address: string): Promise<UserRole> => {
    try {
      const response = await fetch(`/api/access/role?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        return data.role || "guest";
      }
      return "guest";
    } catch {
      return "guest";
    }
  };

  const handleConnect = async () => {
    setError(null);
    setWallet((prev) => ({ ...prev, loading: true }));

    try {
      if (onConnectWallet) {
        const address = await onConnectWallet();
        if (address) {
          const role = await fetchUserRole(address);
          setWallet({
            connected: true,
            address,
            role,
            loading: false,
          });
        } else {
          setWallet((prev) => ({ ...prev, loading: false }));
        }
      } else {
        if (onRedirect) {
          onRedirect(redirectPath);
        }
        setWallet((prev) => ({ ...prev, loading: false }));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to connect wallet");
      setWallet((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRedirect = () => {
    if (onRedirect) {
      onRedirect(redirectPath);
    }
  };

  const hasAccess =
    roleHierarchy[wallet.role] >= roleHierarchy[requiredRole];

  // Loading state
  if (wallet.loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600">Checking access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not connected
  if (!wallet.connected) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-xl">Wallet Connection Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Connect your wallet to access this event page.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <Button className="w-full" onClick={handleConnect}>
              <LogIn className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
            {onRedirect && (
              <Button variant="outline" className="w-full" onClick={handleRedirect}>
                Go to Connect Page
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected but access denied
  if (!hasAccess) {
    const rConfig = roleConfig[wallet.role];
    const reqConfig = roleConfig[requiredRole];

    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldX className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Your current role doesn't have permission to access this page.
            </p>
            <div className="flex items-center justify-center gap-4 py-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Your Role</p>
                <Badge className={rConfig.color}>
                  {rConfig.icon}
                  <span className="ml-1">{rConfig.label}</span>
                </Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Required</p>
                <Badge className={reqConfig.color}>
                  {reqConfig.icon}
                  <span className="ml-1">{reqConfig.label}</span>
                </Badge>
              </div>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
              <code className="text-xs font-mono text-gray-700">
                {wallet.address?.slice(0, 12)}...{wallet.address?.slice(-8)}
              </code>
            </div>
            {onRedirect && (
              <Button variant="outline" className="w-full" onClick={handleRedirect}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Events
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  // Has access — render children with role badge
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Badge className={roleConfig[wallet.role].color}>
          {roleConfig[wallet.role].icon}
          <span className="ml-1">{roleConfig[wallet.role].label}</span>
        </Badge>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default EventAccessGate;
