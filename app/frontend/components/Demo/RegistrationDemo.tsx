'use client';

import React, { useState } from 'react';
import { RegistrationGuard, createWalletRule, createCapacityRule, createExpirationRule } from '../ui/molecules/RegistrationGuard';
import { OptimizedImage } from '../ui/atoms/OptimizedImage';
import { Button } from '../ui/atoms/Button';

export const RegistrationDemo: React.FC = () => {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [currentRegistrations, setCurrentRegistrations] = useState(75);
  const maxCapacity = 100;
  const registrationDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const rules = [
    createWalletRule(isWalletConnected),
    createCapacityRule(currentRegistrations, maxCapacity),
    createExpirationRule(registrationDeadline),
  ];

  const handleConnectWallet = () => {
    setIsWalletConnected(true);
  };

  const handleRegister = () => {
    setCurrentRegistrations(prev => prev + 1);
    alert('Registration successful!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Gatherraa Event Registration
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Demo showcasing RegistrationGuard and OptimizedImage components
        </p>
      </div>

      {/* Event Banner with OptimizedImage */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Event Banner</h2>
        <OptimizedImage
          src="https://picsum.photos/800/400"
          alt="Event banner image"
          aspectRatio="16/9"
          placeholder="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCA0MCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA2QzIyLjIwOTEgNiAyNCA3Ljc5MDg2IDI0IDEwQzI0IDEyLjIwOTEgMjIuMjA5MSAxNCAyMCAxNEMxNy43OTA5IDE0IDE2IDEyLjIwOTEgMTYgMTBDMTYgNy43OTA4NiAxNy43OTA5IDYgMjAgNloiIGZpbGw9IiNENEQ0RDYiLz4KPC9zdmc+Cg=="
          blurUp={true}
          className="rounded-xl shadow-lg"
        />
      </div>

      {/* Registration Status */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Registration Status
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-white dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {currentRegistrations}/{maxCapacity}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Registered
            </div>
          </div>
          
          <div className="text-center p-4 bg-white dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {isWalletConnected ? 'Connected' : 'Not Connected'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Wallet Status
            </div>
          </div>
          
          <div className="text-center p-4 bg-white dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {Math.ceil((registrationDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Registration Closes
            </div>
          </div>
        </div>

        {/* Registration Guard */}
        <RegistrationGuard
          rules={rules}
          fallback={
            <div className="space-y-4">
              <Button
                variant="primary"
                fullWidth
                onClick={handleConnectWallet}
                disabled={isWalletConnected}
              >
                {isWalletConnected ? 'Wallet Connected' : 'Connect Wallet'}
              </Button>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Connect your wallet to enable registration
              </p>
            </div>
          }
        >
          <div className="space-y-4">
            <Button
              variant="primary"
              fullWidth
              onClick={handleRegister}
            >
              Register for Event
            </Button>
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              All requirements met! You can now register for this event.
            </p>
          </div>
        </RegistrationGuard>
      </div>

      {/* Component Showcase */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Component Features
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RegistrationGuard Features */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              RegistrationGuard Component
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>✅ Wallet connection validation</li>
              <li>✅ Event capacity checking</li>
              <li>✅ Registration deadline enforcement</li>
              <li>✅ Custom rule support</li>
              <li>✅ Contextual error messages</li>
              <li>✅ Reusable across event pages</li>
            </ul>
          </div>

          {/* OptimizedImage Features */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              OptimizedImage Component
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>✅ Lazy loading with Intersection Observer</li>
              <li>✅ Blur-up placeholder effect</li>
              <li>✅ Skeleton loading states</li>
              <li>✅ Fallback image on error</li>
              <li>✅ Layout shift prevention</li>
              <li>✅ Responsive aspect ratios</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Image Gallery Demo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <OptimizedImage
              key={i}
              src={`https://picsum.photos/300/200?random=${i}`}
              alt={`Gallery image ${i}`}
              aspectRatio="4/3"
              lazy={true}
              blurUp={true}
              className="rounded-lg shadow-md"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
