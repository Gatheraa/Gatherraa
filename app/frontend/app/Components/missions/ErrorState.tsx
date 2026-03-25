
'use client';
import { AlertCircle } from 'lucide-react';


function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        We couldn&apos;t load missions. Please check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

export default ErrorState;