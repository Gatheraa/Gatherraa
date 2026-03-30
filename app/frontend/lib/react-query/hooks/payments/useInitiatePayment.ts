"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../apiClient';
import { queryKeys } from '../../keys/queryKeys';

interface InitiatePaymentVariables {
  bookingId: string;
}

interface InitiatePaymentResponse {
  authorizationUrl: string;
  reference: string;
}

export const useInitiatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation<
    InitiatePaymentResponse,
    Error,
    InitiatePaymentVariables
  >({
    mutationFn: async ({ bookingId }: InitiatePaymentVariables) => {
      const { data } = await apiClient.post<InitiatePaymentResponse>(
        '/payments/initiate',
        { bookingId }
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.payments });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
    onError: (error) => {
      console.error('Failed to initiate payment:', error);
      // You can add toast notifications here
    },
  });
};
