export interface TicketPlanTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  period: string;
  benefits: string[];
  highlighted: boolean;
  availability: number;
  total: number;
  badge?: string;
}

export interface TicketPlansData {
  eventId: string;
  eventTitle: string;
  tiers: TicketPlanTier[];
}

export interface PurchaseTicketDto {
  eventId: string;
  tierId: string;
  quantity: number;
}
