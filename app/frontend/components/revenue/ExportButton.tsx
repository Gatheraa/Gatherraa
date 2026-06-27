"use client";

import { useRef, useState, useEffect } from "react";
import { Download, FileText, ChevronDown, Loader2 } from "lucide-react";

export type ExportFormat = "csv" | "pdf";

export interface ExportButtonProps {
  onExport?: (format: ExportFormat) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

function generateCSV(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DEFAULT_EXPORT = async (format: ExportFormat) => {
  if (format === "csv") {
    const rows = [
      ["Date", "Tickets Sold", "Revenue ($)"],
      ["Jun 4", "310", "10850"],
      ["Jun 11", "295", "10325"],
      ["Jun 18", "330", "11550"],
      ["Jun 25", "355", "12425"],
    ];
    const csv = generateCSV(rows);
    downloadBlob(new Blob([csv], { type: "text/csv" }), "revenue-report.csv");
  } else {
    // PDF: plain fallback — opens print dialog on the current page
    window.print();
  }
};

export function ExportButton({
  onExport = DEFAULT_EXPORT,
  disabled = false,
  className = "",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExport = async (format: ExportFormat) => {
    setOpen(false);
    setLoading(format);
    try {
      await onExport(format);
    } finally {
      setLoading(null);
    }
  };

  const options: { format: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
    {
      format: "csv",
      label: "Export CSV",
      icon: FileText,
      desc: "Spreadsheet-compatible data",
    },
    {
      format: "pdf",
      label: "Export PDF",
      icon: FileText,
      desc: "Print-ready report",
    },
  ];

  const isLoading = loading !== null;

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || isLoading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium
          hover:bg-primary-hover active:bg-primary-active transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>{isLoading ? `Exporting ${loading?.toUpperCase()}…` : "Export"}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-52 bg-surface border border-border-default
            rounded-xl shadow-xl z-50 overflow-hidden"
          role="listbox"
        >
          {options.map(({ format, label, icon: Icon, desc }) => (
            <button
              key={format}
              role="option"
              onClick={() => handleExport(format)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-elevated
                transition-colors duration-100 group"
            >
              <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary/15">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportButton;
