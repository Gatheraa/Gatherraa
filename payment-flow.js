import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 },  // Spike to 50 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Failure rate must be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || 'test-token'; // Replace with valid JWT in CI

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  // Scenario 1: Stripe Payment Initiation
  const stripePayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 50.00,
    currency: 'USD',
    type: 'ticket_purchase',
    description: 'Load Test Ticket',
    idempotencyKey: `stripe-${randomString(10)}-${Date.now()}`
  });

  const resStripe = http.post(`${BASE_URL}/payments/stripe/initiate`, stripePayload, params);
  
  check(resStripe, {
    'stripe init status is 201': (r) => r.status === 201,
    'stripe returns clientSecret': (r) => r.json('clientSecret') !== undefined,
  });

  sleep(1);

  // Scenario 2: Crypto Payment Initiation
  const cryptoPayload = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 0.1,
    method: 'ethereum',
    type: 'ticket_purchase',
    idempotencyKey: `crypto-${randomString(10)}-${Date.now()}`
  });

  const resCrypto = http.post(`${BASE_URL}/payments/crypto/initiate`, cryptoPayload, params);

  check(resCrypto, {
    'crypto init status is 201': (r) => r.status === 201,
    'crypto returns paymentAddress': (r) => r.json('paymentAddress') !== undefined,
  });
}