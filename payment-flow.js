import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metric to track error rates
export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.01'], // Error rate should be less than 1%
    http_req_duration: ['p(95)<500'], // 95% of requests should be under 500ms
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Simulate a user performing a payment
  // In a real scenario, we would authenticate first to get a token
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token-placeholder',
    },
  };

  // 1. Initiate Stripe Payment
  const stripePayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Load Test Ticket Purchase'
  });

  const res = http.post(`${BASE_URL}/payments/stripe/initiate`, stripePayload, params);

  const success = check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(1);
}