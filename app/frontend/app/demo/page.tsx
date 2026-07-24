"use client";

import React, { useState } from 'react';
import MultiSourceDataAggregator from '../../components/MultiSourceDataAggregator';
import SessionTimeoutManager from '../../components/SessionTimeoutManager';
import { DIDCredentialCard } from '../../components/ui/molecules';
import ConferenceFloorMap from '../../components/ConferenceFloorMap';

// Demo page for testing both components
const ComponentDemoPage: React.FC = () => {
  const sampleCredentials = [
    {
      id: 'cred-kyc',
      type: 'KYC Proof',
      status: 'verified' as const,
      issuerName: 'Civic Pass Provider',
      issuerDid: 'did:key:z6Mkq5Ld8gV9p4K9s7tB8aC7d3f8g9h0',
      timestamp: '2026-06-20T10:00:00Z',
    },
    {
      id: 'cred-email',
      type: 'Email Credential',
      status: 'pending' as const,
      issuerName: 'Gatherraa Auth Server',
      issuerDid: 'did:web:gatherraa.com:auth',
      timestamp: '2026-06-24T12:00:00Z',
    },
    {
      id: 'cred-wallet',
      type: 'Wallet Ownership Proof',
      status: 'revoked' as const,
      issuerName: 'Etherscan Verifier',
      issuerDid: 'did:ethr:0x1234567890123456789012345678901234567890',
      timestamp: '2026-06-01T15:30:00Z',
      revocationReason: 'Private key compromise reported by the wallet holder.',
    },
  ];
  // Sample data sources for MultiSourceDataAggregator
  const dataSources = [
    {
      id: 'users',
      name: 'Users API',
      url: 'https://jsonplaceholder.typicode.com/users',
      transform: (data: any[]) => data.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company.name
      }))
    },
    {
      id: 'posts',
      name: 'Posts API',
      url: 'https://jsonplaceholder.typicode.com/posts',
      transform: (data: any[]) => data.slice(0, 5) // Limit to first 5 posts
    },
    {
      id: 'invalid',
      name: 'Invalid API (for error testing)',
      url: 'https://invalid-url-that-will-fail.com/data',
      timeout: 3000
    }
  ];

  // Session timeout handlers
  const handleSessionTimeout = () => {
    console.log('Session timed out!');
    alert('Your session has expired. Please log in again.');
  };

  const handleExtendSession = async (): Promise<boolean> => {
    console.log('Extending session...');
    // Simulate API call to extend session
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Math.random() > 0.2; // 80% success rate for demo
  };

  const handleSessionWarning = (timeRemaining: number) => {
    console.log(`Session warning: ${timeRemaining}ms remaining`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Component Demo Page
          </h1>
          <p className="text-lg text-gray-600">
            Testing MultiSourceDataAggregator, SessionTimeoutManager, and DIDCredentialCard components
          </p>
        </div>

        {/* DID Credential Card Demo */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            DIDCredentialCard Demo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sampleCredentials.map((cred) => (
              <DIDCredentialCard key={cred.id} credential={cred} />
            ))}
          </div>
        </section>

        {/* ConferenceFloorMap Demo */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            ConferenceFloorMap Demo
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Scroll or use the toolbar to zoom, drag to pan, click a booth for live occupancy details.
          </p>
          <ConferenceFloorMap
            onBoothClick={(booth) => console.log('Booth clicked:', booth)}
          />
        </section>

        {/* MultiSourceDataAggregator Demo */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            MultiSourceDataAggregator Demo
          </h2>
          <MultiSourceDataAggregator
            dataSources={dataSources}
            onDataUpdate={(data) => console.log('Data updated:', data)}
            autoRefresh={true}
            refreshInterval={30000} // 30 seconds
            maxRetries={2}
          />
        </section>

        {/* Instructions */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">
            Session Timeout Manager Instructions
          </h3>
          <ul className="list-disc list-inside text-blue-700 space-y-2">
            <li>Session timeout is set to 2 minutes for demo purposes</li>
            <li>Warning will appear 30 seconds before timeout</li>
            <li>Move your mouse or interact with the page to extend session automatically</li>
            <li>Click &quot;Extend Session&quot; button when warning appears</li>
            <li>Session will extend automatically if you&apos;re active</li>
          </ul>
        </section>
      </div>

      {/* SessionTimeoutManager - hidden by default, appears when needed */}
      <SessionTimeoutManager
        sessionTimeout={2 * 60 * 1000} // 2 minutes for demo
        warningTime={30 * 1000} // 30 seconds warning
        onTimeout={handleSessionTimeout}
        onExtendSession={handleExtendSession}
        onWarning={handleSessionWarning}
        enableActivityTracking={true}
        logoutUrl="/login"
      />
    </div>
  );
};

export default ComponentDemoPage;
