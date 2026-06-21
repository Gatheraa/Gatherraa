'use client';

import { useCallback, useState } from 'react';

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  total: number;
}

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

/**
 * Hook for managing pagination state
 * Provides methods for navigating through pages and selecting page size
 */
export const usePagination = ({
  initialPage = 1,
  initialPageSize = 12,
  total,
}: UsePaginationOptions): UsePaginationReturn => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.ceil(total / pageSize);

  // Ensure current page is valid when total changes
  const validPage = Math.min(currentPage, totalPages || 1);

  const setPage = useCallback((page: number) => {
    const pageNum = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(pageNum);
  }, [totalPages]);

  const setPageSizeHandler = useCallback((newPageSize: number) => {
    if (newPageSize > 0) {
      setPageSize(newPageSize);
      // Reset to first page when page size changes
      setCurrentPage(1);
    }
  }, []);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages || 1);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    setPage(validPage + 1);
  }, [validPage, setPage]);

  const goToPreviousPage = useCallback(() => {
    setPage(validPage - 1);
  }, [validPage, setPage]);

  const hasNextPage = validPage < totalPages;
  const hasPreviousPage = validPage > 1;

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(validPage * pageSize, total);

  return {
    currentPage: validPage,
    pageSize,
    totalPages,
    total,
    setPage,
    setPageSize: setPageSizeHandler,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
  };
};
