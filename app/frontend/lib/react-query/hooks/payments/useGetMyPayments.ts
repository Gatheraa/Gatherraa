"use client";

import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../apiClient';
import { queryKeys } from '../../keys/queryKeys';

interface Payment {
  id: string;
  reference: string;
  bookingId: string;
  amount: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    workspace: {
      id: string;
      name: string;
    };
    startDate: string;
    endDate: string;
  };
}

interface GetMyPaymentsParams {
  page?: number;
  limit?: number;
  status?: 'SUCCESS' | 'PENDING' | 'FAILED';
}

interface GetMyPaymentsResponse {
  data: Payment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const useGetMyPayments = (params: GetMyPaymentsParams = {}) => {
  const { page = 1, limit = 10, status } = params;

  return useQuery<GetMyPaymentsResponse, Error>({
    queryKey: queryKeys.paymentsList({ page, limit, status }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (page) searchParams.set('page', page.toString());
      if (limit) searchParams.set('limit', limit.toString());
      if (status) searchParams.set('status', status);

      const { data } = await apiClient.get<GetMyPaymentsResponse>(
        `/payments?${searchParams.toString()}`
      );
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
