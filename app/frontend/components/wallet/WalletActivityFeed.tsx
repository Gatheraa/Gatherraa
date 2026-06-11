'use client';

import React, { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  type: string;
  timestamp: Date;
  status: 'success' | 'pending' | 'failed';
  amount: number;
  details: string;
}

const WalletActivityFeed: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock transaction data (replace with real API calls)
    const mockTransactions: Transaction[] = [
      { id: '1', type: 'Register', timestamp: new Date(), status: 'success', amount: 0.01, details: 'Registration Complete' },
      { id: '2', type: 'Create Event', timestamp: new Date(), status: 'success', amount: 0.5, details: 'Event "Stellar Summit" Created' },
      { id: '3', type: 'Purchase Ticket', timestamp: new Date(), status: 'success', amount: 0.05, details: 'Purchased ticket for "NFT Art Fair"' },
      { id: '4', type: 'Withdrawal', timestamp: new Date(), status: 'pending', amount: 1.0, details: 'Withdrawal request initiated' },
    ];
    setTransactions(mockTransactions);
    setLoading(false);
  }, [page]);

  const loadMore = () => {
    setLoading(true);
    setPage(prevPage => prevPage + 1);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Recent Activities</h2>
      {transactions.length === 0 ? (
        <p>No recent activity.</p>
      ) : (
        <ul>
          {transactions.map((tx) => (
            <li key={tx.id} className="mb-2 border-b pb-2 last:border-b-0">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="text-sm text-gray-500">{tx.details}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{tx.timestamp.toLocaleTimeString()}</p>
                  <p className={`text-xs ${tx.status === 'success' ? 'text-green-500' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>{tx.status}</p>
                  <p>{tx.amount} Tokens</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <button
          onClick={loadMore}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
        >
          Load More
        </button>
      )}
    </div>
  );
};

export default WalletActivityFeed;

/*
Example usage:
<WalletActivityFeed />
*/


/*
const mockTransactions: Transaction[] = [
      { id: '1', type: 'Register', timestamp: new Date(), status: 'success', amount: 0.01, details: 'Registration Complete' },
      { id: '2', type: 'Create Event', timestamp: new Date(), status: 'success', amount: 0.5, details: 'Event "Stellar Summit" Created' },
      { id: '3', type: 'Purchase Ticket', timestamp: new Date(), status: 'success', amount: 0.05, details: 'Purchased ticket for "NFT Art Fair"' },
      { id: '4', type: 'Withdrawal', timestamp: new Date(), status: 'pending', amount: 1.0, details: 'Withdrawal request initiated' },
      { id: '5', type: 'Deposit', timestamp: new Date(), status: 'success', amount: 2.0, details: 'Deposit completed' },
      { id: '6', type: 'Transfer', timestamp: new Date(), status: 'failed', amount: 0.2, details: 'Transfer to 0x123... failed' },
      { id: '7', type: 'Event Update', timestamp: new Date(), status: 'success', amount: 0, details: 'Updated event details for "Summer Fest"' },
      { id: '8', type: 'Ticket Refund', timestamp: new Date(), status: 'success', amount: 0.05, details: 'Refund for "Indie Film Night"' },
      { id: '9', type: 'Donation', timestamp: new Date(), status: 'success', amount: 0.1, details: 'Donation to local artist' },
      { id: '10', type: 'Fee Payment', timestamp: new Date(), status: 'success', amount: 0.02, details: 'Paid platform usage fees' },
    ];
*/