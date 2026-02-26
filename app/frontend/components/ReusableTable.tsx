import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TableColumn {
  key: string;
  label: string;
}

interface TableRow {
  [key: string]: any;
}

interface ReusableTableProps {
  columns: TableColumn[];
  data: TableRow[];
}

const PAGE_SIZE = 5;

const ReusableTable: React.FC<ReusableTableProps> = ({ columns, data }) => {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return sortDir === 'asc' ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const pagedData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.ceil(data.length / PAGE_SIZE);

  return (
    <div className="table-container">
      <table className="table-auto w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer px-4 py-2"
              >
                {col.label}
                <motion.span
                  animate={{ rotate: sortKey === col.key ? (sortDir === 'asc' ? 0 : 180) : 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-block ml-2"
                >
                  ▼
                </motion.span>
              </th>
            ))}
          </tr>
        </thead>
        <AnimatePresence>
          <motion.tbody
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {pagedData.map((row, index) => (
              <motion.tr
                key={index}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="hover:bg-gray-100"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    {row[col.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </motion.tbody>
        </AnimatePresence>
      </table>
      <div className="pagination-controls flex justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          disabled={page === 0}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
          disabled={page === pageCount - 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ReusableTable;