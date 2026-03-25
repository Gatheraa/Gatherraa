

type Props = {
  statusFilter: string;
  setStatusFilter: (status: any) => void;
  categoryFilter: string;
  setCategoryFilter: (category: any) => void;
  hasFilters: boolean;
  resetFilters: () => void;
  statusConfig: Record<string, { label: string }>;
  categoryConfig: Record<string, { label: string; icon: string }>;
};

export default function FilterPanel({
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  hasFilters,
  resetFilters,
  statusConfig,
  categoryConfig
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 flex flex-wrap gap-4">
      {/* Status Section */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'open', 'in-progress', 'completed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
              }`}
            >
              {s === 'all' ? 'All' : statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Section */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', 'development', 'design', 'research', 'marketing', 'other'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                categoryFilter === c
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
              }`}
            >
              {c === 'all' ? 'All' : `${categoryConfig[c].icon} ${categoryConfig[c].label}`}
            </button>
          ))}
        </div>
      </div>

      {/* Clear All Button */}
      {hasFilters && (
        <div className="flex items-end ml-auto">
          <button 
            onClick={resetFilters} 
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}