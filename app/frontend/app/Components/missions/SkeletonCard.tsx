
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export default SkeletonCard;