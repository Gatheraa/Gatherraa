'use client';

import React, { useState } from 'react';

interface TransactionRetryHandlerProps {
  transactionStatus: 'pending' | 'failed' | 'success';
  errorMessage?: string;
  onRetry: () => Promise<void>;
}

const TransactionRetryHandler: React.FC<TransactionRetryHandlerProps> = ({
  transactionStatus,
  errorMessage,
  onRetry,
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
      setRetryCount(prevCount => prevCount + 1);
      setIsRetrying(false);
    } catch (error: any) {
      setIsRetrying(false);
      console.error('Retry failed:', error);
    }
  };

  if (transactionStatus === 'success') {
    return <p>Transaction successful!</p>;
  }

  if (transactionStatus === 'pending') {
    return <p>Transaction is still pending...</p>;
  }

  if (retryCount >= maxRetries) {
    return <p>Maximum retries reached. Please contact support.</p>;
  }

  return (
    <div>
      <p>Transaction failed: {errorMessage || 'Unknown error'}</p>
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
      >
        {isRetrying ? 'Retrying...' : 'Retry Transaction'}
      </button>
    </div>
  );
};

export default TransactionRetryHandler;

/*
Example Usage:
<TransactionRetryHandler transactionStatus="failed" errorMessage="Insufficient funds" onRetry={() => console.log('Retrying...')} />
*/