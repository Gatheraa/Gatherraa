"use client";

import React, { useState } from "react";
import { TransactionStatusTracker } from "./TransactionStatusTracker";
import { ethers } from "ethers";

// Example usage component demonstrating different scenarios
export function ExampleUsage() {
  const [currentHash, setCurrentHash] = useState("");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Initialize provider on mount
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  }, []);

  // Example transaction hashes for demo
  const exampleHashes = {
    pending: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    confirmed: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    failed: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  };

  const handleTrackTransaction = (hash: string) => {
    setCurrentHash(hash);
  };

  const handleSuccess = (hash: string) => {
    console.log("Transaction confirmed:", hash);
    alert(`Transaction ${hash.slice(0, 10)}... has been confirmed!`);
  };

  const handleError = (error: Error, hash: string) => {
    console.error("Transaction failed:", error, hash);
    alert(`Transaction ${hash.slice(0, 10)}... failed: ${error.message}`);
  };

  const handleTimeout = (hash: string) => {
    console.warn("Transaction timed out:", hash);
    alert(`Transaction ${hash.slice(0, 10)}... timed out`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Transaction Status Tracker Examples</h2>
        <p className="text-gray-600">
          This component tracks blockchain transactions in real-time using either polling or WebSocket connections.
        </p>
      </div>

      {/* Example selection buttons */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select an example transaction to track:</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleTrackTransaction(exampleHashes.pending)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Track Pending Transaction
          </button>
          <button
            onClick={() => handleTrackTransaction(exampleHashes.confirmed)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Track Confirmed Transaction
          </button>
          <button
            onClick={() => handleTrackTransaction(exampleHashes.failed)}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Track Failed Transaction
          </button>
        </div>
      </div>

      {/* Current tracker */}
      {currentHash && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Current Transaction Tracker:</h3>
          <TransactionStatusTracker
            txHash={currentHash}
            provider={provider}
            pollingInterval={3000}
            timeout={60000}
            explorerUrl="https://etherscan.io/tx"
            onSuccess={handleSuccess}
            onError={handleError}
            onTimeout={handleTimeout}
            labels={{
              pending: "⏳ Pending Confirmation",
              confirmed: "✅ Confirmed",
              failed: "❌ Failed",
              timeout: "⏰ Timed Out",
            }}
          />
        </div>
      )}

      {/* Multiple trackers example */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Multiple Transaction Trackers:</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <TransactionStatusTracker
            txHash={exampleHashes.pending}
            provider={provider}
            pollingInterval={5000}
            timeout={30000}
            explorerUrl="https://etherscan.io/tx"
            showTimestamp={true}
            className="border-blue-200"
          />
          <TransactionStatusTracker
            txHash={exampleHashes.confirmed}
            provider={provider}
            pollingInterval={5000}
            timeout={30000}
            explorerUrl="https://etherscan.io/tx"
            showTimestamp={true}
            className="border-green-200"
          />
        </div>
      </div>

      {/* Minimal configuration example */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Minimal Configuration:</h3>
        <TransactionStatusTracker
          txHash={exampleHashes.pending}
          provider={provider}
          showHash={false}
          showTimestamp={false}
          pollingInterval={10000}
          timeout={120000}
          className="max-w-sm"
        />
      </div>

      {/* WebSocket example (if available) */}
      {process.env.NODE_ENV === "development" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">WebSocket Tracking (Development Only):</h3>
          <TransactionStatusTracker
            txHash={exampleHashes.pending}
            provider={provider}
            useWebSocket={true}
            websocketUrl="ws://localhost:8546"
            pollingInterval={5000}
            timeout={60000}
            explorerUrl="https://etherscan.io/tx"
          />
        </div>
      )}

      {/* Usage instructions */}
      <div className="bg-gray-50 p-6 rounded-lg space-y-4">
        <h3 className="text-lg font-semibold">Usage Instructions:</h3>
        <div className="space-y-2 text-sm">
          <p><strong>Required Props:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><code>txHash</code> - The transaction hash to track</li>
            <li><code>provider</code> - Ethers provider for blockchain interaction</li>
          </ul>
          
          <p><strong>Optional Props:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><code>pollingInterval</code> - How often to poll (default: 5000ms)</li>
            <li><code>timeout</code> - Maximum tracking time (default: 300000ms)</li>
            <li><code>explorerUrl</code> - Blockchain explorer URL for links</li>
            <li><code>useWebSocket</code> - Use WebSocket instead of polling</li>
            <li><code>onSuccess/onError/onTimeout</code> - Event callbacks</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ExampleUsage;
