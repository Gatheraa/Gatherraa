import { useCallback } from "react";

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function useCsvExport<T>(
  columns: { header: string; accessor: (row: T) => string | number }[],
  filename = "export.csv",
) {
  return useCallback(
    (rows: T[]) => {
      const header = columns.map((col) => csvEscape(col.header)).join(",");
      const lines = rows.map((row) =>
        columns.map((col) => csvEscape(col.accessor(row))).join(","),
      );
      const csv = [header, ...lines].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [columns, filename],
  );
}
