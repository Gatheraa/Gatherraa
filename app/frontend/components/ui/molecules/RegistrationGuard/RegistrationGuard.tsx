'use client';

import React from 'react';
import { Wallet, Clock, Users, AlertCircle } from 'lucide-react';
import { Button } from '../../atoms';

// ─── Types ────────────────────────────────────────────────────────────

export interface RegistrationRule {
  type: 'wallet' | 'capacity' | 'expiration' | 'custom';
  isValid: boolean;
  message?: string;
  customCheck?: () => boolean | Promise<boolean>;
}

export interface RegistrationGuardProps {
  /** Array of rules to validate registration */
  rules: RegistrationRule[];
  /** Children to render when all rules pass */
  children: React.ReactNode;
  /** Custom fallback component when rules fail */
  fallback?: React.ReactNode;
  /** Show individual rule status */
  showRuleDetails?: boolean;
  /** Custom className for the container */
  className?: string;
}

// ─── Default Rule Messages ─────────────────────────────────────────────

const DEFAULT_MESSAGES = {
  wallet: 'Connect your wallet to register',
  capacity: 'Event is full',
  expiration: 'Registration period has ended',
  custom: 'Registration requirements not met',
};

// ─── Helper Components ─────────────────────────────────────────────────

interface RuleStatusProps {
  rule: RegistrationRule;
  showDetails: boolean;
}

const RuleStatus: React.FC<RuleStatusProps> = ({ rule, showDetails }) => {
  if (!showDetails || rule.isValid) return null;

  const getIcon = () => {
    switch (rule.type) {
      case 'wallet':
        return <Wallet className="w-5 h-5" />;
      case 'capacity':
        return <Users className="w-5 h-5" />;
      case 'expiration':
        return <Clock className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      {getIcon()}
      <span>{rule.message || DEFAULT_MESSAGES[rule.type]}</span>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────

export const RegistrationGuard: React.FC<RegistrationGuardProps> = ({
  rules,
  children,
  fallback,
  showRuleDetails = true,
  className = '',
}) => {
  // Evaluate all rules
  const evaluateRules = async (): Promise<{
    allValid: boolean;
    invalidRules: RegistrationRule[];
  }> => {
    const evaluatedRules = await Promise.all(
      rules.map(async (rule) => {
        if (rule.type === 'custom' && rule.customCheck) {
          const isValid = await rule.customCheck();
          return { ...rule, isValid };
        }
        return rule;
      })
    );

    const invalidRules = evaluatedRules.filter((rule) => !rule.isValid);
    return {
      allValid: invalidRules.length === 0,
      invalidRules,
    };
  };

  // For now, we'll use synchronous evaluation since custom checks might be async
  // In a real implementation, you might want to handle loading states
  const invalidRules = rules.filter((rule) => !rule.isValid);
  const allValid = invalidRules.length === 0;

  // If all rules are valid, render children
  if (allValid) {
    return <>{children}</>;
  }

  // Render fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default fallback UI
  return (
    <div className={`space-y-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-full mb-3">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Registration Not Available
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please resolve the following requirements to register for this event.
        </p>
      </div>

      {/* Rule Details */}
      {showRuleDetails && invalidRules.length > 0 && (
        <div className="space-y-3">
          {invalidRules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <RuleStatus rule={rule} showDetails={true} />
            </div>
          ))}
        </div>
      )}

      {/* Action Button for Wallet Connection */}
      {invalidRules.some((rule) => rule.type === 'wallet') && (
        <div className="pt-2">
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Wallet className="w-4 h-4" />}
            onClick={() => {
              // In a real app, this would trigger wallet connection
              console.log('Connect wallet clicked');
            }}
          >
            Connect Wallet
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Preset Rule Helpers ─────────────────────────────────────────────────

export const createWalletRule = (isConnected: boolean): RegistrationRule => ({
  type: 'wallet',
  isValid: isConnected,
  message: isConnected ? undefined : 'Connect your wallet to register',
});

export const createCapacityRule = (currentRegistrations: number, maxCapacity: number): RegistrationRule => ({
  type: 'capacity',
  isValid: currentRegistrations < maxCapacity,
  message: currentRegistrations >= maxCapacity 
    ? `Event is full (${maxCapacity} attendees)` 
    : undefined,
});

export const createExpirationRule = (registrationDeadline: Date): RegistrationRule => ({
  type: 'expiration',
  isValid: new Date() < registrationDeadline,
  message: new Date() >= registrationDeadline 
    ? `Registration ended on ${registrationDeadline.toLocaleDateString()}` 
    : undefined,
});

export const createCustomRule = (
  check: () => boolean | Promise<boolean>,
  message: string
): RegistrationRule => ({
  type: 'custom',
  isValid: false, // Will be evaluated at runtime
  customCheck: check,
  message,
});
