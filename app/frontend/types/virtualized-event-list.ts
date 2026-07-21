export interface EventRecord {
    id: string;
    title: string;
    group: string;
}

export interface VirtualizedEventListProps<T> {
    items: T[];
    hasMore?: boolean;
    isLoading?: boolean;

    renderRow(item: T): React.ReactNode;

    getRowHeight?(item: T): number;

    groupBy?(item: T): string;

    onLoadMore?(): void;
}