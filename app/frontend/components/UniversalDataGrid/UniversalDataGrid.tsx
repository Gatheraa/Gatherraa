"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ColumnPinningState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pin, PinOff, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import { useCsvExport } from "./useCsvExport";
import type { UniversalDataGridColumn, UniversalDataGridProps } from "./types";

function buildColumnDefs<T>(columns: UniversalDataGridColumn<T>[]) {
  const helper = createColumnHelper<T>();
  return columns.map((col) =>
    helper.accessor((row) => col.accessor(row), {
      id: col.id,
      header: col.header,
      size: col.width ?? 150,
      enableSorting: col.enableSort ?? true,
      enableColumnFilter: col.enableFilter ?? true,
      cell: (info) => info.getValue(),
    }),
  );
}

export default function UniversalDataGrid<T>({
  data,
  columns,
  getRowId,
  rowHeight = 40,
  height = 480,
  className = "",
}: UniversalDataGridProps<T>) {
  const columnDefs = useMemo(() => buildColumnDefs(columns), [columns]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({});
  const [pinMenuOpenFor, setPinMenuOpenFor] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({
    row: -1,
    col: 0,
  });

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, columnFilters, columnPinning },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnPinningChange: setColumnPinning,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  const exportCsv = useCsvExport(
    columns.map((c) => ({ header: c.header, accessor: c.accessor })),
    "data-grid-export.csv",
  );
  const handleExport = useCallback(() => {
    exportCsv(rows.map((r) => r.original));
  }, [exportCsv, rows]);

  const cellRefs = useRef(new Map<string, HTMLElement>());
  const registerCellRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  useEffect(() => {
    const key = `${activeCell.row}-${activeCell.col}`;
    const el = cellRefs.current.get(key);
    if (el) el.focus();
  }, [activeCell, virtualRows]);

  const moveActiveCell = useCallback(
    (rowDelta: number, colDelta: number) => {
      setActiveCell((prev) => {
        const nextCol = Math.max(
          0,
          Math.min(leafColumns.length - 1, prev.col + colDelta),
        );
        const nextRow = Math.max(
          -1,
          Math.min(rows.length - 1, prev.row + rowDelta),
        );
        if (rowDelta !== 0 && nextRow >= 0) {
          rowVirtualizer.scrollToIndex(nextRow, { align: "auto" });
        }
        return { row: nextRow, col: nextCol };
      });
    },
    [leafColumns.length, rows.length, rowVirtualizer],
  );

  const handleGridKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveActiveCell(1, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveActiveCell(-1, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveActiveCell(0, 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveActiveCell(0, -1);
          break;
        case "Enter":
        case " ": {
          if (activeCell.row === -1) {
            event.preventDefault();
            const column = leafColumns[activeCell.col];
            if (column?.getCanSort()) column.toggleSorting();
          }
          break;
        }
        default:
          break;
      }
    },
    [activeCell, leafColumns, moveActiveCell],
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div
        role="grid"
        aria-rowcount={rows.length}
        aria-colcount={leafColumns.length}
        onKeyDown={handleGridKeyDown}
        ref={scrollRef}
        style={{ height }}
        className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      >
        <div
          style={{
            minWidth: leafColumns.reduce((sum, c) => sum + c.getSize(), 0),
          }}
        >
          <div
            role="row"
            className="flex sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
          >
            {leafColumns.map((column, colIndex) => {
              const isPinned = column.getIsPinned();
              const isActive =
                activeCell.row === -1 && activeCell.col === colIndex;
              const sortDir = column.getIsSorted();
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  aria-sort={
                    sortDir === "asc"
                      ? "ascending"
                      : sortDir === "desc"
                        ? "descending"
                        : "none"
                  }
                  tabIndex={isActive ? 0 : -1}
                  ref={registerCellRef(`-1-${colIndex}`)}
                  onFocus={() => setActiveCell({ row: -1, col: colIndex })}
                  onClick={() => column.getCanSort() && column.toggleSorting()}
                  style={{
                    width: column.getSize(),
                    position: isPinned ? "sticky" : undefined,
                    left:
                      isPinned === "left" ? column.getStart("left") : undefined,
                    right:
                      isPinned === "right"
                        ? column.getAfter("right")
                        : undefined,
                    zIndex: isPinned ? 30 : undefined,
                  }}
                  className={`relative flex flex-col gap-1 px-2 py-1.5 border-r border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                    isPinned
                      ? "bg-zinc-50 dark:bg-zinc-900 shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 cursor-pointer select-none">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                      {column.columnDef.header as string}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {column.getCanSort() &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-zinc-500" />
                        ) : sortDir === "desc" ? (
                          <ArrowDown className="w-3 h-3 text-zinc-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-zinc-300 dark:text-zinc-600" />
                        ))}
                      <button
                        type="button"
                        aria-label={`Pin options for ${column.columnDef.header as string}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinMenuOpenFor((prev) =>
                            prev === column.id ? null : column.id,
                          );
                        }}
                        className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {isPinned ? (
                          <Pin className="w-3 h-3 text-blue-500" />
                        ) : (
                          <PinOff className="w-3 h-3 text-zinc-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {pinMenuOpenFor === column.id && (
                    <div className="absolute top-full left-0 mt-1 z-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg text-xs overflow-hidden w-28">
                      <button
                        type="button"
                        onClick={() => {
                          column.pin("left");
                          setPinMenuOpenFor(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Pin left
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          column.pin("right");
                          setPinMenuOpenFor(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Pin right
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          column.pin(false);
                          setPinMenuOpenFor(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Unpin
                      </button>
                    </div>
                  )}

                  {column.getCanFilter() && (
                    <input
                      type="text"
                      value={(column.getFilterValue() as string) ?? ""}
                      onChange={(e) => column.setFilterValue(e.target.value)}
                      placeholder="Filter..."
                      aria-label={`Filter ${column.columnDef.header as string}`}
                      className="w-full text-xs px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ paddingTop, paddingBottom }}>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={virtualRow.index + 1}
                  style={{ height: rowHeight }}
                  className="flex border-b border-zinc-100 dark:border-zinc-900"
                >
                  {row.getVisibleCells().map((cell, colIndex) => {
                    const column = cell.column;
                    const isPinned = column.getIsPinned();
                    const isActive =
                      activeCell.row === virtualRow.index &&
                      activeCell.col === colIndex;
                    return (
                      <div
                        key={cell.id}
                        role="gridcell"
                        tabIndex={isActive ? 0 : -1}
                        ref={registerCellRef(`${virtualRow.index}-${colIndex}`)}
                        onFocus={() =>
                          setActiveCell({ row: virtualRow.index, col: colIndex })
                        }
                        style={{
                          width: column.getSize(),
                          position: isPinned ? "sticky" : undefined,
                          left:
                            isPinned === "left"
                              ? column.getStart("left")
                              : undefined,
                          right:
                            isPinned === "right"
                              ? column.getAfter("right")
                              : undefined,
                          zIndex: isPinned ? 10 : undefined,
                        }}
                        className={`flex items-center px-2 text-xs text-zinc-700 dark:text-zinc-300 truncate border-r border-zinc-100 dark:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                          isPinned
                            ? "bg-white dark:bg-zinc-950 shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                            : ""
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
