import { useEffect, useMemo, useRef } from "react";

export interface VirtualizedEventListProps<T> {
  items: T[];
  isLoading?: boolean;
  hasMore?: boolean;

  renderRow(item: T): React.ReactNode;

  groupBy?(item: T): string;

  getRowHeight?(item: T): number;

  onLoadMore?(): void;
}

export function VirtualizedEventList<T>({
  items,
  renderRow,
  groupBy,
  getRowHeight,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: VirtualizedEventListProps<T>) {
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loaderRef.current || !hasMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        threshold: 1,
      }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const groupedItems = useMemo(() => {
    if (!groupBy) {
      return [
        {
          title: "",
          items,
        },
      ];
    }

    const map = new Map<string, T[]>();

    items.forEach((item) => {
      const key = groupBy(item);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)?.push(item);
    });

    return Array.from(map.entries()).map(([title, items]) => ({
      title,
      items,
    }));
  }, [items, groupBy]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        Loading events...
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="flex justify-center py-8 text-gray-500">
        No events found.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[700px]">
      {groupedItems.map((group) => (
        <div key={group.title}>
          {group.title && (
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 font-semibold">
              {group.title}
            </div>
          )}

          {group.items.map((item, index) => (
            <div
              key={index}
              style={{
                height: getRowHeight
                  ? getRowHeight(item)
                  : "auto",
              }}
            >
              {renderRow(item)}
            </div>
          ))}
        </div>
      ))}

      {hasMore && (
        <div
          ref={loaderRef}
          className="py-6 text-center text-sm text-gray-500"
        >
          Loading more events...
        </div>
      )}
    </div>
  );
}