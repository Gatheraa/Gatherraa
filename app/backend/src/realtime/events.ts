export type RealtimeEvent =
  | { type: 'NEW_REGISTRATION'; payload: any }
  | { type: 'PAYMENT_CONFIRMED'; payload: any }
  | { type: 'CAPACITY_UPDATED'; payload: any }
  | { type: 'PONG' };

export type RealtimeListener = (event: RealtimeEvent) => void;
