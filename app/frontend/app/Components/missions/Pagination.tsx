
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
  isLoading: boolean;
  isError: boolean;
};

export default function Pagination({
  currentPage,
  totalPages,
  setCurrentPage,
  isLoading,
  isError
}: Props) {
  // Don't show anything if loading, error, or only 1 page
  if (isLoading || isError || totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8 mb-6">
      {/* Previous Button */}
      <button
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>

      {/* Page Numbers */}
      <div className="flex gap-1">
        {Array.from({ length: totalPages }).map((_, i) => {
          const page = i + 1;
          const isActive = page === currentPage;
          
          // Logic to show first, last, and pages near the current one
          const isNear = Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;

          if (!isNear) {
            // Show ellipsis if we are at the "gap" points
            if (page === 2 || page === totalPages - 1) {
              return <span key={page} className="px-2 py-2 text-gray-400 text-sm">…</span>;
            }
            return null;
          }

          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}