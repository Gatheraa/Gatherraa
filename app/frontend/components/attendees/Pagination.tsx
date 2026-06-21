'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/atoms/Button';
import { Text } from '@/components/ui/atoms/Text';

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Show page size selector */
  showPageSizeSelector?: boolean;
  /** Available page sizes */
  pageSizeOptions?: number[];
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Maximum number of page buttons to show */
  maxButtons?: number;
  /** CSS class */
  className?: string;
}

/**
 * Pagination component for navigating through pages of attendees
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  showPageSizeSelector = false,
  pageSizeOptions = [12, 24, 48],
  onPageSizeChange,
  maxButtons = 5,
  className = '',
}) => {
  if (totalPages <= 1) {
    return null;
  }

  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const leftBound = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    const rightBound = Math.min(totalPages, leftBound + maxButtons - 1);
    const adjustedLeftBound = Math.max(1, rightBound - maxButtons + 1);

    if (adjustedLeftBound > 1) {
      pages.push(1);
      if (adjustedLeftBound > 2) {
        pages.push('...');
      }
    }

    for (let i = adjustedLeftBound; i <= rightBound; i++) {
      pages.push(i);
    }

    if (rightBound < totalPages) {
      if (rightBound < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col gap-4 items-center justify-between ${className}`}>
      {/* Info and Page Size Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
        <Text variant="caption" className="text-gray-600">
          Showing <span className="font-semibold">{startItem}</span> to{' '}
          <span className="font-semibold">{endItem}</span> of{' '}
          <span className="font-semibold">{totalItems}</span> results
        </Text>

        {showPageSizeSelector && pageSizeOptions && (
          <div className="flex items-center gap-2">
            <Text variant="caption" className="text-gray-600">
              Per page:
            </Text>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {/* First Page Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft size={16} />
        </Button>

        {/* Previous Page Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) => {
            if (page === '...') {
              return (
                <Text key={`ellipsis-${idx}`} variant="body-sm" className="px-2">
                  …
                </Text>
              );
            }

            const pageNum = page as number;
            const isCurrentPage = pageNum === currentPage;

            return (
              <Button
                key={pageNum}
                variant={isCurrentPage ? 'primary' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                disabled={isCurrentPage}
                aria-label={`Page ${pageNum}`}
                aria-current={isCurrentPage ? 'page' : undefined}
                className="min-w-10"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={16} />
        </Button>

        {/* Last Page Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight size={16} />
        </Button>
      </div>
    </div>
  );
};

Pagination.displayName = 'Pagination';
