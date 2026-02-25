import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Example data
const initialData = [
  { id: 1, name: 'Alice', age: 28 },
  { id: 2, name: 'Bob', age: 34 },
  { id: 3, name: 'Charlie', age: 22 },
  { id: 4, name: 'Diana', age: 30 },
  { id: 5, name: 'Eve', age: 25 },
  { id: 6, name: 'Frank', age: 40 },
  { id: 7, name: 'Grace', age: 27 },
  { id: 8, name: 'Hank', age: 33 },
];

const PAGE_SIZE = 4;

const sortData = (
  data: { id: number; name: string; age: number }[],
  sortKey: keyof { id: number; name: string; age: number },
  direction: 'asc' | 'desc'
) => {
  return [...data].sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return direction === 'asc' ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

export default function DataTable() {
  const [data, setData] = useState(initialData);
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'age'>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sortedData = sortData(data, sortKey, sortDir);
  const pagedData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: keyof { id: number; name: string; age: number }) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const pageCount = Math.ceil(data.length / PAGE_SIZE);

  return (
    <div style={{ maxWidth: 600, margin: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>
              ID
              <motion.span
                style={{ display: 'inline-block', marginLeft: 4 }}
                animate={{ rotate: sortKey === 'id' ? (sortDir === 'asc' ? 0 : 180) : 0 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
            </th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
              Name
              <motion.span
                style={{ display: 'inline-block', marginLeft: 4 }}
                animate={{ rotate: sortKey === 'name' ? (sortDir === 'asc' ? 0 : 180) : 0 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
            </th>
            <th style={{ cursor: 'pointer' }} onClick={() => handleSort('age')}>
              Age
              <motion.span
                style={{ display: 'inline-block', marginLeft: 4 }}
                animate={{ rotate: sortKey === 'age' ? (sortDir === 'asc' ? 0 : 180) : 0 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
            </th>
          </tr>
        </thead>
        <AnimatePresence>
          <motion.tbody
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
          >
            {pagedData.map((row: { id: number; name: string; age: number }) => (
              <motion.tr
                key={row.id}
                whileHover={{ scale: 1.03, backgroundColor: '#f0f8ff' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ cursor: 'pointer', transition: 'background-color 0.3s' }}
              >
                <td>{row.id}</td>
                <td>{row.name}</td>
                <td>{row.age}</td>
              </motion.tr>
            ))}
          </motion.tbody>
        </AnimatePresence>
      </table>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          disabled={page === 0}
          style={{ marginRight: 8 }}
        >
          Prev
        </button>
        <span>Page {page + 1} of {pageCount}</span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
          disabled={page === pageCount - 1}
          style={{ marginLeft: 8 }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
