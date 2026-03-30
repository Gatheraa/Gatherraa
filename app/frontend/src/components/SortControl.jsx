import React from 'react';

export default function SortControl({ sortBy, onChange }) {
  return (
    <div className="flex items-center space-x-4">
      <label htmlFor="sort" className="text-sm font-medium text-gray-700">
        Sort by:
      </label>
      <select
        id="sort"
        value={sortBy}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
      >
        <option value="date">Date</option>
        <option value="popularity">Popularity</option>
        <option value="price">Price</option>
      </select>
    </div>
  );
}
