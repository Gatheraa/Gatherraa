export interface UniversalDataGridColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => string | number;
  width?: number;
  enableSort?: boolean;
  enableFilter?: boolean;
}

export interface UniversalDataGridProps<T> {
  data: T[];
  columns: UniversalDataGridColumn<T>[];
  getRowId: (row: T) => string;
  /** Row height in pixels, used by the virtualizer. Default: 40. */
  rowHeight?: number;
  /** Height in pixels of the scrollable viewport. Default: 480. */
  height?: number;
  className?: string;
}
