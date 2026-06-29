import { apiGet } from './client';
import type { TicketPlansData } from '../../types/ticket-plans';

export const ticketPlansApi = {
  getPlans: async (eventId: string): Promise<TicketPlansData> => {
    return apiGet<TicketPlansData>(`/booking/plans/${eventId}`);
  },
};
