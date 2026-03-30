'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProposalDetail from '@/components/dao/ProposalDetail';
import { getProposal } from '@/lib/api/dao';
import { Proposal } from '@/types/proposal';
import Link from 'next/link';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';
import { WrongNetworkAlert } from '@/components/wallet/WrongNetworkAlert';

const ProposalDetailPage: React.FC = () => {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const data = await getProposal(id);
        if (data) {
          setProposal(data);
        } else {
          setError('Proposal not found');
        }
      } catch (err) {
        setError('Failed to fetch proposal');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProposal();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Proposal not found'}</p>
          <Link href="/dao" className="text-blue-600 dark:text-blue-400 hover:underline">Back to Proposals</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gatherraa</h1>
          <div className="flex items-center gap-3">
            <WalletAddress />
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wrong Network Alert */}
        <div className="mb-6">
          <WrongNetworkAlert />
        </div>

        <Link href="/dao" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Proposals</Link>
        <ProposalDetail proposal={proposal} />
      </div>
    </div>
  );
};

export default ProposalDetailPage;