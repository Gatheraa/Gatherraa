export const queryKeys = {
  // Auth
  user: ['user'] as const,
  
  // Bookings
  bookings: ['bookings'] as const,
  booking: (id: string) => ['bookings', id] as const,
  
  // Payments
  payments: ['payments'] as const,
  paymentsList: (filters?: { page?: number; limit?: number; status?: string }) => 
    ['payments', 'list', filters] as const,
  payment: (reference: string) => ['payments', reference] as const,
  
  // Workspaces
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspaces', id] as const,
  
  // Invoices
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  
  // Analytics
  analytics: ['analytics'] as const,
  analyticsOverview: () => ['analytics', 'overview'] as const,
  analyticsTransactions: () => ['analytics', 'transactions'] as const,
  analyticsReports: () => ['analytics', 'reports'] as const,
} as const;

export type QueryKey = typeof queryKeys[keyof typeof queryKeys];
