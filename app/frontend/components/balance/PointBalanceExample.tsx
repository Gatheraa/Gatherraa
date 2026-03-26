'use client';

import React from 'react';
import PointBalance from './PointBalance';
import type { PointBalance as PointBalanceType } from '@/types/pointBalance';

/**
 * PointBalance Component Example
 * Demonstrates various usage patterns with mock data
 */
export default function PointBalanceExample() {
  // Mock balance data
  const mockBalance: PointBalanceType = {
    id: 'balance-1',
    userId: 'user-123',
    totalBalance: 5250.75,
    availableBalance: 5000.00,
    lockedBalance: 200.00,
    pendingBalance: 50.75,
    currency: 'PTS',
    decimals: 2,
    lastUpdated: new Date(),
    percentageChange: 5.2,
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">PointBalance Component Examples</h1>

      {/* Example 1: Simple Compact Widget */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 1: Simple Compact Balance</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Basic usage with just a balance number. Shows formatted balance with tooltip.
          </p>
          <PointBalance
            balance={5250.75}
            variant="compact"
            currency="PTS"
            showCurrency={true}
            tooltip="Your available points balance"
          />
        </div>
      </section>

      {/* Example 2: Compact with Percentage Change */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 2: Compact with Trend</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Shows balance with percentage change indicator (trending up/down).
          </p>
          <PointBalance
            fullBalance={mockBalance}
            variant="compact"
            onRefresh={() => console.log('Refreshing balance...')}
          />
        </div>
      </section>

      {/* Example 3: Detailed Variant */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 3: Detailed Breakdown</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Shows full balance details with breakdown of available, locked, and pending amounts.
          </p>
          <PointBalance
            fullBalance={mockBalance}
            variant="detailed"
            onRefresh={() => console.log('Refreshing balance...')}
          />
        </div>
      </section>

      {/* Example 4: Loading State */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 4: Loading State</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Shows loading skeleton while fetching data.
          </p>
          <PointBalance
            isLoading={true}
            variant="compact"
          />
        </div>
      </section>

      {/* Example 5: Error State */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 5: Error State</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Shows error message when data fetch fails.
          </p>
          <PointBalance
            error="Failed to fetch balance. Please try again."
            onRefresh={() => console.log('Retrying...')}
            variant="compact"
          />
        </div>
      </section>

      {/* Example 6: With Custom Styling */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Example 6: Custom Styling</h2>
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Apply custom CSS classes for styling flexibility.
          </p>
          <PointBalance
            balance={5250.75}
            variant="compact"
            className="p-4 bg-blue-50 rounded border border-blue-200"
            currency="PTS"
          />
        </div>
      </section>

      {/* Example 7: Integration Guide */}
      <section className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Integration Steps</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Import PointBalance component and usePointBalance hook</li>
          <li>Create proper TypeScript types using pointBalance.ts interfaces</li>
          <li>Set up API endpoint: GET /api/points/balance?userId={'{userId}'}</li>
          <li>Use hook to manage balance state with auto-refresh</li>
          <li>Pass props to control display variant and behavior</li>
          <li>Customize with CSS classes and props as needed</li>
        </ol>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-2">API Response Format</h3>
          <pre className="bg-white p-3 rounded text-xs overflow-x-auto text-gray-700">
{`{
  "success": true,
  "balance": {
    "id": "balance-1",
    "userId": "user-123",
    "totalBalance": 5250.75,
    "availableBalance": 5000.00,
    "lockedBalance": 200.00,
    "pendingBalance": 50.75,
    "currency": "PTS",
    "decimals": 2,
    "lastUpdated": "2024-03-26T10:30:00Z",
    "percentageChange": 5.2
  }
}`}
          </pre>
        </div>
      </section>

      {/* Example 8: Component Props Reference */}
      <section className="p-6 bg-gray-900 rounded-lg text-gray-100">
        <h2 className="text-lg font-semibold mb-3">Props Reference</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2">Prop</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Default</th>
              <th className="text-left py-2">Description</th>
            </tr>
          </thead>
          <tbody className="space-y-1">
            <tr className="border-b border-gray-700">
              <td className="py-2">balance</td>
              <td>number | null</td>
              <td>null</td>
              <td>Simple balance number</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">fullBalance</td>
              <td>PointBalance</td>
              <td>null</td>
              <td>Complete balance object with breakdown</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">isLoading</td>
              <td>boolean</td>
              <td>false</td>
              <td>Show loading skeleton</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">error</td>
              <td>string | null</td>
              <td>null</td>
              <td>Error message to display</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">variant</td>
              <td>'compact' | 'detailed'</td>
              <td>compact</td>
              <td>Display variant</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">onRefresh</td>
              <td>() => void</td>
              <td>undefined</td>
              <td>Refresh callback</td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-2">currency</td>
              <td>string</td>
              <td>PTS</td>
              <td>Currency symbol/code</td>
            </tr>
            <tr>
              <td className="py-2">decimals</td>
              <td>number</td>
              <td>2</td>
              <td>Decimal places</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
